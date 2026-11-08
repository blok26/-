import { useEffect, useState, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { getAppDatabase, isFirebaseConfigured } from '../services/firebase';
import { RoomSettings, PlayerProfile, GameState, GameResults } from '../types/game';
import * as roomService from '../services/roomService';
import * as localRoomService from '../services/localRoomService';

export function useRoom(roomCode: string | null, myUid: string | null) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [settings, setSettings] = useState<RoomSettings>({
    roundsCount: 8,
    roundDurationSec: 60,
    difficulty: 'mixed',
  });
  const [players, setPlayers] = useState<Record<string, PlayerProfile>>({});
  const [gameState, setGameState] = useState<GameState>({
    status: 'lobby',
    currentRound: 0,
    totalRounds: 8,
    drawerUid: '',
    guesserUid: '',
    roundStartedAt: 0,
    roundDurationSec: 60,
    score: 0,
    correctRounds: 0,
    secretCategory: '',
    secretLength: 0,
    clearVersion: 0,
  });
  const [results, setResults] = useState<GameResults | null>(null);

  useEffect(() => {
    if (!roomCode) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // If Firebase is not configured, use local simulation subscriptions
    if (!isFirebaseConfigured() || !getAppDatabase()) {
      const unsub = localRoomService.subscribeLocalRoom(roomCode, (data) => {
        setLoading(false);
        if (!data) {
          setError('لم يتم العثور على الغرفة أو تم إغلاقها.');
          return;
        }

        if (data.settings) setSettings(data.settings);
        if (data.players) setPlayers(data.players);
        else setPlayers({});

        if (data.game) setGameState(data.game);
        if (data.results) setResults(data.results);
      });

      return () => unsub();
    }

    const db = getAppDatabase();
    if (!db) {
      setLoading(false);
      return;
    }

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsub = onValue(
      roomRef,
      (snap) => {
        setLoading(false);
        const data = snap.val();
        if (!data) {
          setError('لم يتم العثور على الغرفة أو تم إغلاقها.');
          return;
        }

        if (data.settings) setSettings(data.settings);
        if (data.players) setPlayers(data.players);
        else setPlayers({});

        if (data.game) setGameState(data.game);
        if (data.results) setResults(data.results);
      },
      (err) => {
        setLoading(false);
        setError('تعذر تحميل بيانات الغرفة: ' + err.message);
      }
    );

    return () => unsub();
  }, [roomCode]);

  const updateSettings = useCallback(
    async (newSettings: Partial<RoomSettings>) => {
      if (!roomCode) return;
      await roomService.updateRoomSettings(roomCode, newSettings);
    },
    [roomCode]
  );

  const toggleReady = useCallback(
    async (ready: boolean) => {
      if (!roomCode || !myUid) return;
      await roomService.togglePlayerReady(roomCode, myUid, ready);
    },
    [roomCode, myUid]
  );

  const startGame = useCallback(async () => {
    if (!roomCode) return;
    await roomService.startGameCountdown(roomCode, players, settings);
  }, [roomCode, players, settings]);

  const leave = useCallback(async () => {
    if (!roomCode || !myUid) return;
    await roomService.leaveRoom(roomCode, myUid);
  }, [roomCode, myUid]);

  const myPlayer = myUid ? players[myUid] : undefined;
  const isHost = Boolean(myPlayer?.isHost);

  return {
    loading,
    error,
    settings,
    players,
    gameState,
    results,
    myPlayer,
    isHost,
    updateSettings,
    toggleReady,
    startGame,
    leave,
  };
}
