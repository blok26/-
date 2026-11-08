import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { getAppDatabase, isFirebaseConfigured } from '../services/firebase';
import * as localRoomService from '../services/localRoomService';
import { useRoom } from '../hooks/useRoom';
import { usePresence } from '../hooks/usePresence';
import { useWebRTC } from '../hooks/useWebRTC';
import { useCanvasSync } from '../hooks/useCanvasSync';
import { useGameTimer } from '../hooks/useGameTimer';
import { GameHeader } from './GameHeader';
import { WaitingRoom } from './WaitingRoom';
import { DrawingCanvas } from './DrawingCanvas';
import { GuessPanel } from './GuessPanel';
import { RoundResult } from './RoundResult';
import { GameOver } from './GameOver';
import {
  startDrawingRound,
  submitGuess,
  finishRoundWithSuccess,
  finishRoundWithTimeout,
  transitionToNextRoundOrGameOver,
  resetGameToLobby,
  getLocalSecretWord,
  revealRoundHint,
  swapDrawerRoles,
  startNewRoundDirectly,
  notifyIncorrectGuess,
} from '../services/roomService';
import { getRandomWord } from '../data/arabicWords';
import { isArabicGuessCorrect, getWordMask, ArabicWord } from '../utils/normalizeArabic';
import { GuessMessage } from '../types/game';
import { playTickSound, playHintChime, playTimeoutTone } from '../utils/soundEffects';
import { Clock, AlertTriangle, Users, Sparkles, RefreshCw, Play, RotateCcw } from 'lucide-react';

interface RoomProps {
  roomCode: string;
  myUid: string;
  onExitRoom: () => void;
}

export const Room: React.FC<RoomProps> = ({ roomCode, myUid, onExitRoom }) => {
  const {
    loading,
    error,
    settings,
    players,
    gameState,
    results,
    isHost,
    updateSettings,
    toggleReady,
    startGame,
    leave,
  } = useRoom(roomCode, myUid);

  const { presenceMap, isConnectedToFirebase } = usePresence(roomCode, myUid);
  const {
    callStatus,
    isMuted,
    micVolume,
    voiceError,
    joinVoice,
    toggleMute,
    leaveVoice,
  } = useWebRTC(roomCode, myUid, isHost);

  const isDrawer = gameState.drawerUid === myUid;
  const currentRound = gameState.currentRound || 1;

  // Local secret word state on drawer's phone
  const [localSecretWord, setLocalSecretWord] = useState<ArabicWord | null>(() => {
    return getLocalSecretWord(roomCode, currentRound);
  });

  // Guesses for current round
  const [guesses, setGuesses] = useState<GuessMessage[]>([]);

  // 3-second countdown state
  const [countdownNum, setCountdownNum] = useState<number>(3);

  // Track whether hint chime has been played for this round
  const hintChimePlayedRef = useRef<boolean>(false);

  // Sync canvas hook
  const {
    strokes,
    startStroke,
    appendPoint,
    endStroke,
    undoLastStroke,
    clearCanvas,
  } = useCanvasSync({
    roomCode,
    roundId: currentRound,
    isDrawer,
    drawerUid: gameState.drawerUid,
    myUid,
    clearVersion: gameState.clearVersion || 0,
  });

  const activeCountdownRoundRef = useRef<number | null>(null);

  // Handle countdown phase
  useEffect(() => {
    if (gameState.status !== 'countdown') {
      activeCountdownRoundRef.current = null;
      setCountdownNum(3);
      return;
    }

    // Only initiate countdown once per round
    if (activeCountdownRoundRef.current === currentRound) {
      return;
    }
    activeCountdownRoundRef.current = currentRound;

    hintChimePlayedRef.current = false;
    playTickSound();
    let current = 3;
    setCountdownNum(current);

    const interval = setInterval(() => {
      current--;
      setCountdownNum(current);
      playTickSound();

      if (current <= 0) {
        clearInterval(interval);
        const isBotDrawer =
          gameState.drawerUid.startsWith('bot-') ||
          players[gameState.drawerUid]?.name?.includes('🤖') ||
          !players[gameState.drawerUid];

        if (isDrawer || (isHost && isBotDrawer)) {
          const pickedWord = getRandomWord(settings.difficulty);
          if (isDrawer) {
            setLocalSecretWord(pickedWord);
          } else {
            setLocalSecretWord(null);
          }
          const actualDrawer = gameState.drawerUid || myUid;
          const actualGuesser =
            Object.keys(players).find((u) => u !== actualDrawer) || myUid;

          startDrawingRound(
            roomCode,
            currentRound,
            actualDrawer,
            actualGuesser,
            pickedWord,
            settings.roundDurationSec
          ).catch(console.error);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.status, currentRound, isDrawer, isHost, gameState.drawerUid, myUid, players, roomCode, settings]);

  // Listen to guesses in current round
  useEffect(() => {
    if (!roomCode || currentRound <= 0) {
      setGuesses([]);
      return;
    }

    if (!isFirebaseConfigured() || !getAppDatabase()) {
      const unsub = localRoomService.subscribeLocalGuesses(roomCode, currentRound, (list) => {
        setGuesses(list);
      });
      return () => unsub();
    }

    const db = getAppDatabase();
    if (!db) return;

    const guessesRef = ref(db, `rooms/${roomCode}/guesses/${currentRound}`);
    const unsub = onValue(guessesRef, (snap) => {
      const data = snap.val();
      if (!data) {
        setGuesses([]);
        return;
      }
      const list: GuessMessage[] = Object.values(data);
      list.sort((a, b) => a.createdAt - b.createdAt);
      setGuesses(list);
    });

    return () => unsub();
  }, [roomCode, currentRound]);

  // Drawer automated verification of incoming guesses!
  useEffect(() => {
    if (!isDrawer || gameState.status !== 'drawing' || !localSecretWord) return;

    for (const guess of guesses) {
      if (guess.uid !== myUid && !guess.isCorrect) {
        if (isArabicGuessCorrect(guess.text, localSecretWord)) {
          finishRoundWithSuccess(
            roomCode,
            currentRound,
            guess.id,
            localSecretWord,
            secondsLeftRef.current,
            gameState.score || 0,
            gameState.correctRounds || 0
          ).catch(console.error);
          break;
        }
      }
    }
  }, [guesses, isDrawer, gameState.status, localSecretWord, myUid, roomCode, currentRound, gameState.score, gameState.correctRounds]);

  // Handle timeout
  const handleTimeExpired = useCallback(() => {
    if (isDrawer && gameState.status === 'drawing' && localSecretWord) {
      finishRoundWithTimeout(roomCode, localSecretWord.displayWord).catch(console.error);
    }
  }, [isDrawer, gameState.status, localSecretWord, roomCode]);

  // Game timer with halfway detection for hint
  const { secondsLeft, progressPercent, isUrgent, isHalfway, secondsUntilHalfway } = useGameTimer({
    roundStartedAt: gameState.roundStartedAt,
    durationSec: gameState.roundDurationSec || 60,
    isActive: gameState.status === 'drawing',
    onTimeExpired: handleTimeExpired,
  });

  const secondsLeftRef = useRef(secondsLeft);
  secondsLeftRef.current = secondsLeft;

  // Half-time hint sound & trigger
  useEffect(() => {
    if (gameState.status !== 'drawing') return;

    if (isHalfway && !hintChimePlayedRef.current) {
      hintChimePlayedRef.current = true;
      playHintChime();

      if (isDrawer && !gameState.hintRevealed) {
        revealRoundHint(roomCode).catch(console.error);
      }
    }
  }, [isHalfway, gameState.status, isDrawer, gameState.hintRevealed, roomCode]);

  // Drawer manual acceptance of guess (خمن صح)
  const handleAcceptManual = useCallback(
    (guess?: GuessMessage) => {
      if (!isDrawer || !localSecretWord) return;
      finishRoundWithSuccess(
        roomCode,
        currentRound,
        guess?.id || null,
        localSecretWord,
        secondsLeftRef.current,
        gameState.score || 0,
        gameState.correctRounds || 0
      ).catch(console.error);
    },
    [isDrawer, localSecretWord, roomCode, currentRound, gameState.score, gameState.correctRounds]
  );

  // Drawer button: خمن غلط
  const handleDrawerMarkIncorrect = useCallback(() => {
    if (!isDrawer) return;
    notifyIncorrectGuess(roomCode, currentRound, '❌ تخمين خاطئ، فكّر تاني وخمّن صح 😉').catch(console.error);
    playTimeoutTone();
  }, [isDrawer, roomCode, currentRound]);

  // Swap Drawer Roles button
  const handleSwapDrawer = useCallback(() => {
    swapDrawerRoles(roomCode, gameState.drawerUid, players).catch(console.error);
  }, [roomCode, gameState.drawerUid, players]);

  // Start New Round button (without exiting/re-entering)
  const handleStartNewRound = useCallback(() => {
    startNewRoundDirectly(roomCode, gameState.drawerUid, players, true).catch(console.error);
  }, [roomCode, gameState.drawerUid, players]);

  // Submit guess
  const handleSubmitGuess = useCallback(
    (text: string) => {
      const myPlayer = players[myUid];
      submitGuess(roomCode, currentRound, myUid, myPlayer?.name || 'مخمّن', text).catch(console.error);
    },
    [roomCode, currentRound, myUid, players]
  );

  // Next round trigger
  const handleNextRound = useCallback(() => {
    transitionToNextRoundOrGameOver(
      roomCode,
      currentRound,
      gameState.totalRounds || settings.roundsCount,
      gameState.drawerUid,
      players
    ).catch(console.error);
  }, [roomCode, currentRound, gameState.totalRounds, gameState.drawerUid, settings.roundsCount, players]);

  // Play again trigger
  const handlePlayAgain = useCallback(() => {
    resetGameToLobby(roomCode, settings.roundsCount, settings.roundDurationSec).catch(console.error);
  }, [roomCode, settings.roundsCount, settings.roundDurationSec]);

  // Leave room
  const handleLeave = useCallback(async () => {
    leaveVoice();
    await leave();
    onExitRoom();
  }, [leaveVoice, leave, onExitRoom]);

  // Check if other player disconnected
  const otherPlayer = Object.values(players).find((p) => p.uid !== myUid);
  const isOtherPlayerOffline =
    otherPlayer && presenceMap[otherPlayer.uid]?.online === false;

  const drawerName = players[gameState.drawerUid]?.name || 'الرسام';
  const guesserName = players[gameState.guesserUid]?.name || 'المخمّن';

  // Secret word mask for guesser (switches to revealedMask at halfway)
  const isHintUnlocked = Boolean(gameState.hintRevealed || isHalfway);
  const guesserMask = gameState.roundSecretWord
    ? gameState.roundSecretWord
    : isHintUnlocked
    ? gameState.revealedMask || gameState.initialMask || 'ـ'.repeat(Math.max(1, gameState.secretLength || 4))
    : gameState.initialMask || 'ـ'.repeat(Math.max(1, gameState.secretLength || 4));

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-600">جاري الاتصال بالغرفة {roomCode}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-xl border border-rose-200">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-800">تعذر الوصول إلى الغرفة</h3>
            <p className="text-xs text-rose-600 mt-1">{error}</p>
          </div>
          <button
            onClick={handleLeave}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-xs transition-colors"
          >
            العودة للصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50/70 flex flex-col justify-between selection:bg-amber-500 selection:text-white">
      {/* Top Header */}
      <GameHeader
        roomCode={roomCode}
        roundNumber={gameState.currentRound || 0}
        totalRounds={gameState.totalRounds || settings.roundsCount}
        score={gameState.score || 0}
        isOnline={isConnectedToFirebase}
        callStatus={callStatus}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onJoinVoice={joinVoice}
        onLeaveRoom={handleLeave}
      />

      {/* Disconnect Warning Banner */}
      {isOtherPlayerOffline && gameState.status !== 'lobby' && (
        <div className="bg-amber-500 text-white text-xs font-bold px-4 py-2 flex items-center justify-center gap-2 shadow-xs">
          <Users className="w-4 h-4 animate-pulse" />
          <span>اللاعب الآخر انقطع اتصاله، في انتظار عودته... لم يتم مسح نتيجتكم!</span>
        </div>
      )}

      {/* Main Game Content based on status */}
      <main className="flex-1 max-w-lg w-full mx-auto p-3 flex flex-col justify-center">
        {/* PHASE 1: LOBBY */}
        {gameState.status === 'lobby' && (
          <WaitingRoom
            roomCode={roomCode}
            isHost={isHost}
            myUid={myUid}
            players={players}
            presenceMap={presenceMap}
            settings={settings}
            onUpdateSettings={updateSettings}
            onToggleReady={toggleReady}
            onStartGame={startGame}
            callStatus={callStatus}
            isMuted={isMuted}
            micVolume={micVolume}
            voiceError={voiceError}
            onJoinVoice={joinVoice}
            onToggleMute={toggleMute}
          />
        )}

        {/* PHASE 2: COUNTDOWN */}
        {gameState.status === 'countdown' && (
          <div className="text-center py-12 space-y-6 animate-in fade-in zoom-in-95">
            <div className="space-y-2">
              <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full">
                الجولة {currentRound} من {gameState.totalRounds || settings.roundsCount}
              </span>
              <h2 className="text-xl font-black text-slate-800">
                {isDrawer ? 'استعد للرسم! 🎨' : 'استعد للتخمين! 👀'}
              </h2>
              <p className="text-xs text-slate-500">
                الرسام في هذه الجولة: <strong className="text-indigo-600">{drawerName}</strong>
              </p>
            </div>

            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-orange-400 text-white mx-auto flex items-center justify-center text-5xl font-black shadow-xl shadow-orange-500/25 animate-bounce">
              {countdownNum}
            </div>

            <p className="text-xs text-slate-400">تبدأ الجولة خلال لحظات...</p>
          </div>
        )}

        {/* PHASE 3: DRAWING */}
        {gameState.status === 'drawing' && (
          <div className="flex flex-col gap-2 w-full animate-in fade-in">
            {/* Timer Bar & Quick Control Actions */}
            <div className="w-full bg-white rounded-2xl p-2.5 shadow-xs border border-amber-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center gap-1 font-black text-xs px-2.5 py-1 rounded-xl shrink-0 ${
                    isUrgent
                      ? 'bg-rose-100 text-rose-700 animate-pulse'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{secondsLeft} ثانية</span>
                </div>

                <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isUrgent ? 'bg-rose-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Quick in-game actions: New Round & Swap Drawer */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleStartNewRound}
                  className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="بدء جولة جديدة فورًا بدون الخروج من الغرفة"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>جولة جديدة</span>
                </button>

                <button
                  type="button"
                  onClick={handleSwapDrawer}
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors"
                  title="تبديل دور الرسام فورًا بين اللاعبين"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>تبديل الرسام</span>
                </button>
              </div>
            </div>

            {/* Drawing Canvas */}
            <DrawingCanvas
              strokes={strokes}
              isDrawer={isDrawer}
              secretWord={localSecretWord?.displayWord}
              category={gameState.secretCategory}
              onStartStroke={startStroke}
              onAppendPoint={appendPoint}
              onEndStroke={endStroke}
              onUndo={undoLastStroke}
              onClear={clearCanvas}
            />

            {/* Guess Panel with Half-Time Hint & Drawer Judgment buttons */}
            <GuessPanel
              isDrawer={isDrawer}
              wordMask={guesserMask}
              category={gameState.secretCategory}
              revealedChar={gameState.revealedChar}
              isHintRevealed={isHintUnlocked}
              secondsUntilHint={secondsUntilHalfway}
              wordCount={gameState.wordCount}
              letterCount={gameState.secretLength}
              guesses={guesses}
              onSubmitGuess={handleSubmitGuess}
              onAcceptManualCorrect={handleAcceptManual}
              onDrawerMarkCorrect={() => handleAcceptManual()}
              onDrawerMarkIncorrect={handleDrawerMarkIncorrect}
              disabled={false}
            />
          </div>
        )}

        {/* PHASE 4: ROUND RESULT MODAL */}
        {gameState.status === 'roundResult' && (
          <RoundResult
            roundNumber={currentRound}
            totalRounds={gameState.totalRounds || settings.roundsCount}
            secretWord={gameState.roundSecretWord || localSecretWord?.displayWord || '...'}
            category={gameState.secretCategory}
            drawerName={drawerName}
            guesserName={guesserName}
            isSuccess={Boolean(gameState.drawerGuessedCorrectly)}
            score={gameState.score || 0}
            onNextRound={handleNextRound}
            onSwapDrawer={handleSwapDrawer}
            isHost={isHost}
          />
        )}

        {/* PHASE 5: GAME OVER */}
        {gameState.status === 'gameOver' && (
          <GameOver
            results={results}
            totalScore={gameState.score || 0}
            correctRounds={gameState.correctRounds || 0}
            totalRounds={gameState.totalRounds || settings.roundsCount}
            onPlayAgain={handlePlayAgain}
            onReturnToLobby={() => resetGameToLobby(roomCode, settings.roundsCount, settings.roundDurationSec)}
            isHost={isHost}
          />
        )}
      </main>
    </div>
  );
};
