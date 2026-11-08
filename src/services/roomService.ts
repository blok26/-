import {
  ref,
  set,
  get,
  update,
  runTransaction,
  serverTimestamp,
  push,
} from 'firebase/database';
import { getAppDatabase, isFirebaseConfigured } from './firebase';
import { RoomSettings, PlayerProfile, GameState, GuessMessage, GameResults } from '../types/game';
import { ArabicWord, generateWordHint } from '../utils/normalizeArabic';
import * as localRoomService from './localRoomService';

// Alphabet without visually ambiguous characters (no 0, O, 1, I, L)
const ROOM_CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    result += ROOM_CODE_CHARS[idx];
  }
  return result;
}

const AVATAR_COLORS = [
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#eab308', // Amber
  '#3b82f6', // Blue
  '#ef4444', // Red
];

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

const LOCAL_SECRET_KEY = 'drawit_current_secret_word';

export function saveLocalSecretWord(roomCode: string, roundId: number, word: ArabicWord) {
  try {
    sessionStorage.setItem(`${LOCAL_SECRET_KEY}_${roomCode}_${roundId}`, JSON.stringify(word));
  } catch (e) {
    console.error('Failed to store secret word locally:', e);
  }
}

export function getLocalSecretWord(roomCode: string, roundId: number): ArabicWord | null {
  try {
    const raw = sessionStorage.getItem(`${LOCAL_SECRET_KEY}_${roomCode}_${roundId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function createRoom(
  hostUid: string,
  hostName: string,
  avatarColor: string,
  settings?: Partial<RoomSettings>
): Promise<string> {
  const code = generateRoomCode();

  if (!isFirebaseConfigured()) {
    // Instant Local Simulation Mode
    return localRoomService.createLocalRoom(code, hostUid, hostName, avatarColor, settings);
  }

  const db = getAppDatabase();
  if (!db) {
    return localRoomService.createLocalRoom(code, hostUid, hostName, avatarColor, settings);
  }

  let attempts = 0;
  let activeCode = code;
  let created = false;

  const defaultSettings: RoomSettings = {
    roundsCount: 8,
    roundDurationSec: 60,
    difficulty: 'mixed',
    ...settings,
  };

  while (!created && attempts < 5) {
    attempts++;
    if (attempts > 1) {
      activeCode = generateRoomCode();
    }
    const metaRef = ref(db, `rooms/${activeCode}/meta`);

    const result = await runTransaction(metaRef, (currentMeta) => {
      if (currentMeta === null) {
        return {
          status: 'lobby',
          hostUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt: Date.now() + 2 * 60 * 60 * 1000,
          playerCount: 1,
          isFull: false,
        };
      }
      return undefined;
    });

    if (result.committed) {
      created = true;
      break;
    }
  }

  if (!created) {
    throw new Error('تعذر إنشاء كود غرفة فريد، يرجى المحاولة ثانية');
  }

  const updates: Record<string, any> = {};
  updates[`rooms/${activeCode}/settings`] = defaultSettings;
  updates[`rooms/${activeCode}/players/${hostUid}`] = {
    uid: hostUid,
    name: hostName.trim().slice(0, 20),
    avatarColor,
    isHost: true,
    ready: true,
    micEnabled: false,
    joinedAt: Date.now(),
  };
  updates[`rooms/${activeCode}/game`] = {
    status: 'lobby',
    currentRound: 0,
    totalRounds: defaultSettings.roundsCount,
    drawerUid: '',
    guesserUid: '',
    roundStartedAt: 0,
    roundDurationSec: defaultSettings.roundDurationSec,
    score: 0,
    correctRounds: 0,
    secretCategory: '',
    secretLength: 0,
    clearVersion: 0,
  };

  await update(ref(db), updates);

  return activeCode;
}

export async function joinRoom(
  roomCode: string,
  playerUid: string,
  playerName: string,
  avatarColor: string
): Promise<{ isHost: boolean }> {
  const cleanCode = roomCode.trim().toUpperCase();

  if (!isFirebaseConfigured()) {
    return localRoomService.joinLocalRoom(cleanCode, playerUid, playerName, avatarColor);
  }

  const db = getAppDatabase();
  if (!db) {
    return localRoomService.joinLocalRoom(cleanCode, playerUid, playerName, avatarColor);
  }

  const metaRef = ref(db, `rooms/${cleanCode}/meta`);
  const metaSnap = await get(metaRef);

  if (!metaSnap.exists()) {
    // Check if it exists locally in fallback
    if (localRoomService.getLocalRoom(cleanCode)) {
      return localRoomService.joinLocalRoom(cleanCode, playerUid, playerName, avatarColor);
    }
    throw new Error('رمز الغرفة غير موجود. تأكد من إدخال 6 أحرف صحيحة.');
  }

  const meta = metaSnap.val();
  if (meta.expiresAt && Date.now() > meta.expiresAt) {
    throw new Error('انتهت صلاحية هذه الغرفة (أكثر من ساعتين).');
  }

  const playersRef = ref(db, `rooms/${cleanCode}/players`);
  const playersSnap = await get(playersRef);
  const currentPlayers = playersSnap.val() || {};
  const currentUids = Object.keys(currentPlayers);

  if (currentUids.includes(playerUid)) {
    await update(ref(db, `rooms/${cleanCode}/players/${playerUid}`), {
      name: playerName.trim().slice(0, 20),
      avatarColor,
    });
    return { isHost: currentPlayers[playerUid]?.isHost || false };
  }

  if (currentUids.length >= 2) {
    throw new Error('عذرًا، الغرفة ممتلئة! الحد الأقصى هو لاعبان اثنان فقط.');
  }

  const isHost = currentUids.length === 0;

  const updates: Record<string, any> = {};
  updates[`rooms/${cleanCode}/players/${playerUid}`] = {
    uid: playerUid,
    name: playerName.trim().slice(0, 20),
    avatarColor,
    isHost,
    ready: false,
    micEnabled: false,
    joinedAt: Date.now(),
  };
  updates[`rooms/${cleanCode}/meta/playerCount`] = currentUids.length + 1;
  updates[`rooms/${cleanCode}/meta/isFull`] = currentUids.length + 1 >= 2;
  updates[`rooms/${cleanCode}/meta/updatedAt`] = Date.now();

  await update(ref(db), updates);

  return { isHost };
}

export async function updateRoomSettings(roomCode: string, settings: Partial<RoomSettings>) {
  if (!isFirebaseConfigured()) {
    localRoomService.updateLocalRoomSettings(roomCode, settings);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.updateLocalRoomSettings(roomCode, settings);
    return;
  }
  await update(ref(db, `rooms/${roomCode}/settings`), settings);
  if (settings.roundsCount !== undefined) {
    await update(ref(db, `rooms/${roomCode}/game`), {
      totalRounds: settings.roundsCount,
    });
  }
}

export async function togglePlayerReady(roomCode: string, uid: string, ready: boolean) {
  if (!isFirebaseConfigured()) {
    localRoomService.toggleLocalPlayerReady(roomCode, uid, ready);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.toggleLocalPlayerReady(roomCode, uid, ready);
    return;
  }
  await update(ref(db, `rooms/${roomCode}/players/${uid}`), { ready });
}

export async function updatePlayerMic(roomCode: string, uid: string, micEnabled: boolean) {
  if (!isFirebaseConfigured()) {
    localRoomService.updateLocalPlayerMic(roomCode, uid, micEnabled);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.updateLocalPlayerMic(roomCode, uid, micEnabled);
    return;
  }
  await update(ref(db, `rooms/${roomCode}/players/${uid}`), { micEnabled });
}

export async function startGameCountdown(
  roomCode: string,
  players: Record<string, PlayerProfile>,
  settings: RoomSettings
) {
  if (!isFirebaseConfigured()) {
    localRoomService.startLocalGameCountdown(roomCode);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.startLocalGameCountdown(roomCode);
    return;
  }

  const uids = Object.keys(players);
  if (uids.length < 2) {
    throw new Error('يجب تواجد لاعبين اثنين لبدء اللعبة!');
  }

  const hostUid = uids.find((u) => players[u].isHost) || uids[0];
  const guesserUid = uids.find((u) => u !== hostUid) || uids[1];

  const gameRef = ref(db, `rooms/${roomCode}/game`);
  await runTransaction(gameRef, (current) => {
    if (current && current.status !== 'lobby' && current.status !== 'gameOver') {
      return undefined;
    }
    return {
      status: 'countdown',
      currentRound: 1,
      totalRounds: settings.roundsCount,
      drawerUid: hostUid,
      guesserUid: guesserUid,
      roundStartedAt: 0,
      roundDurationSec: settings.roundDurationSec,
      score: 0,
      correctRounds: 0,
      secretCategory: '',
      secretLength: 0,
      clearVersion: 0,
    };
  });

  await update(ref(db, `rooms/${roomCode}/meta`), {
    status: 'countdown',
    updatedAt: Date.now(),
  });
}

export async function startDrawingRound(
  roomCode: string,
  roundNumber: number,
  drawerUid: string,
  guesserUid: string,
  secretWord: ArabicWord,
  durationSec: number
) {
  saveLocalSecretWord(roomCode, roundNumber, secretWord);

  if (!isFirebaseConfigured()) {
    localRoomService.startLocalDrawingRound(roomCode, roundNumber, drawerUid, guesserUid, secretWord, durationSec);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.startLocalDrawingRound(roomCode, roundNumber, drawerUid, guesserUid, secretWord, durationSec);
    return;
  }

  const hint = generateWordHint(secretWord.displayWord);

  const updates: Record<string, any> = {
    [`rooms/${roomCode}/game/status`]: 'drawing',
    [`rooms/${roomCode}/game/currentRound`]: roundNumber,
    [`rooms/${roomCode}/game/drawerUid`]: drawerUid,
    [`rooms/${roomCode}/game/guesserUid`]: guesserUid,
    [`rooms/${roomCode}/game/roundStartedAt`]: Date.now(),
    [`rooms/${roomCode}/game/roundDurationSec`]: durationSec,
    [`rooms/${roomCode}/game/secretCategory`]: secretWord.category,
    [`rooms/${roomCode}/game/secretLength`]: hint.letterCount,
    [`rooms/${roomCode}/game/wordCount`]: hint.wordCount,
    [`rooms/${roomCode}/game/initialMask`]: hint.initialMask,
    [`rooms/${roomCode}/game/revealedMask`]: hint.revealedMask,
    [`rooms/${roomCode}/game/revealedChar`]: hint.revealedChar,
    [`rooms/${roomCode}/game/hintRevealed`]: false,
    [`rooms/${roomCode}/game/roundSecretWord`]: null,
    [`rooms/${roomCode}/game/clearVersion`]: 0,
    [`rooms/${roomCode}/meta/status`]: 'drawing',
  };

  await update(ref(db), updates);
}

export async function revealRoundHint(roomCode: string) {
  if (!isFirebaseConfigured()) {
    localRoomService.revealLocalRoundHint(roomCode);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.revealLocalRoundHint(roomCode);
    return;
  }

  await update(ref(db, `rooms/${roomCode}/game`), {
    hintRevealed: true,
  });
}

export async function submitGuess(
  roomCode: string,
  roundId: number,
  uid: string,
  playerName: string,
  text: string
) {
  if (!isFirebaseConfigured()) {
    localRoomService.submitLocalGuess(roomCode, roundId, uid, playerName, text);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.submitLocalGuess(roomCode, roundId, uid, playerName, text);
    return;
  }

  const cleanText = text.trim().slice(0, 80);
  if (!cleanText) return;

  const guessesRef = ref(db, `rooms/${roomCode}/guesses/${roundId}`);
  const newGuessRef = push(guessesRef);

  await set(newGuessRef, {
    id: newGuessRef.key,
    uid,
    playerName,
    text: cleanText,
    isCorrect: false,
    createdAt: Date.now(),
  });
}

export async function finishRoundWithSuccess(
  roomCode: string,
  roundId: number,
  guessId: string | null,
  secretWord: ArabicWord,
  remainingSeconds: number,
  currentScore: number,
  correctCount: number
) {
  if (!isFirebaseConfigured()) {
    localRoomService.finishLocalRoundWithSuccess(
      roomCode,
      roundId,
      guessId,
      secretWord,
      remainingSeconds,
      currentScore,
      correctCount
    );
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.finishLocalRoundWithSuccess(
      roomCode,
      roundId,
      guessId,
      secretWord,
      remainingSeconds,
      currentScore,
      correctCount
    );
    return;
  }

  const roundPoints = 100 + Math.max(0, Math.floor(remainingSeconds * 2));
  const newScore = currentScore + roundPoints;
  const newCorrect = correctCount + 1;

  const updates: Record<string, any> = {
    [`rooms/${roomCode}/game/status`]: 'roundResult',
    [`rooms/${roomCode}/game/roundSecretWord`]: secretWord.displayWord,
    [`rooms/${roomCode}/game/score`]: newScore,
    [`rooms/${roomCode}/game/correctRounds`]: newCorrect,
    [`rooms/${roomCode}/game/drawerGuessedCorrectly`]: true,
    [`rooms/${roomCode}/game/roundEndedAt`]: Date.now(),
    [`rooms/${roomCode}/meta/status`]: 'roundResult',
  };

  if (guessId) {
    updates[`rooms/${roomCode}/guesses/${roundId}/${guessId}/isCorrect`] = true;
  }

  await update(ref(db), updates);
}

export async function finishRoundWithTimeout(
  roomCode: string,
  secretWordDisplay: string
) {
  if (!isFirebaseConfigured()) {
    localRoomService.finishLocalRoundWithTimeout(roomCode, secretWordDisplay);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.finishLocalRoundWithTimeout(roomCode, secretWordDisplay);
    return;
  }

  const updates: Record<string, any> = {
    [`rooms/${roomCode}/game/status`]: 'roundResult',
    [`rooms/${roomCode}/game/roundSecretWord`]: secretWordDisplay,
    [`rooms/${roomCode}/game/drawerGuessedCorrectly`]: false,
    [`rooms/${roomCode}/game/roundEndedAt`]: Date.now(),
    [`rooms/${roomCode}/meta/status`]: 'roundResult',
  };

  await update(ref(db), updates);
}

export async function transitionToNextRoundOrGameOver(
  roomCode: string,
  currentRound: number,
  totalRounds: number,
  currentDrawerUid: string,
  players: Record<string, PlayerProfile>
) {
  if (!isFirebaseConfigured()) {
    localRoomService.transitionLocalToNextRoundOrGameOver(
      roomCode,
      currentRound,
      totalRounds,
      currentDrawerUid,
      players
    );
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.transitionLocalToNextRoundOrGameOver(
      roomCode,
      currentRound,
      totalRounds,
      currentDrawerUid,
      players
    );
    return;
  }

  const uids = Object.keys(players);
  if (currentRound >= totalRounds) {
    const gameSnap = await get(ref(db, `rooms/${roomCode}/game`));
    const gameData: GameState = gameSnap.val() || {};

    const totalScore = gameData.score || 0;
    const correctCount = gameData.correctRounds || 0;
    const ratio = correctCount / Math.max(1, totalRounds);

    let titleBadge = 'فريق الأحلام!';
    if (ratio >= 0.8) {
      titleBadge = 'رسامان عبقريان 🎨✨';
    } else if (ratio >= 0.5) {
      titleBadge = 'على نفس الموجة 🌊';
    } else {
      titleBadge = 'نحتاج دورة رسم صغيرة 😄';
    }

    const results: GameResults = {
      totalScore,
      correctCount,
      roundsCount: totalRounds,
      averageGuessTimeSec: Math.round((totalRounds * 60) / Math.max(1, correctCount)),
      bestRoundTimeSec: 15,
      titleBadge,
    };

    const updates: Record<string, any> = {
      [`rooms/${roomCode}/game/status`]: 'gameOver',
      [`rooms/${roomCode}/meta/status`]: 'gameOver',
      [`rooms/${roomCode}/results`]: results,
    };
    await update(ref(db), updates);
  } else {
    const nextRound = currentRound + 1;
    const nextDrawerUid = uids.find((u) => u !== currentDrawerUid) || currentDrawerUid;
    const nextGuesserUid = uids.find((u) => u === currentDrawerUid) || uids[0];

    const updates: Record<string, any> = {
      [`rooms/${roomCode}/game/status`]: 'countdown',
      [`rooms/${roomCode}/game/currentRound`]: nextRound,
      [`rooms/${roomCode}/game/drawerUid`]: nextDrawerUid,
      [`rooms/${roomCode}/game/guesserUid`]: nextGuesserUid,
      [`rooms/${roomCode}/game/roundSecretWord`]: null,
      [`rooms/${roomCode}/game/drawerGuessedCorrectly`]: null,
      [`rooms/${roomCode}/game/clearVersion`]: 0,
      [`rooms/${roomCode}/meta/status`]: 'countdown',
    };
    await update(ref(db), updates);
  }
}

export async function resetGameToLobby(roomCode: string, totalRounds: number, durationSec: number) {
  if (!isFirebaseConfigured()) {
    localRoomService.resetLocalGameToLobby(roomCode, totalRounds, durationSec);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.resetLocalGameToLobby(roomCode, totalRounds, durationSec);
    return;
  }

  const updates: Record<string, any> = {
    [`rooms/${roomCode}/game/status`]: 'lobby',
    [`rooms/${roomCode}/game/currentRound`]: 0,
    [`rooms/${roomCode}/game/score`]: 0,
    [`rooms/${roomCode}/game/correctRounds`]: 0,
    [`rooms/${roomCode}/game/roundSecretWord`]: null,
    [`rooms/${roomCode}/meta/status`]: 'lobby',
    [`rooms/${roomCode}/canvas`]: null,
    [`rooms/${roomCode}/guesses`]: null,
    [`rooms/${roomCode}/results`]: null,
  };

  await update(ref(db), updates);
}

export async function leaveRoom(roomCode: string, uid: string) {
  if (!isFirebaseConfigured()) {
    localRoomService.leaveLocalRoom(roomCode, uid);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.leaveLocalRoom(roomCode, uid);
    return;
  }

  const playerRef = ref(db, `rooms/${roomCode}/players/${uid}`);
  const playerSnap = await get(playerRef);

  if (playerSnap.exists()) {
    await set(playerRef, null);
    await set(ref(db, `rooms/${roomCode}/presence/${uid}`), null);

    const playersSnap = await get(ref(db, `rooms/${roomCode}/players`));
    const remaining = playersSnap.val() || {};
    const count = Object.keys(remaining).length;

    if (count === 0) {
      await set(ref(db, `rooms/${roomCode}`), null);
    } else {
      await update(ref(db, `rooms/${roomCode}/meta`), {
        playerCount: count,
        isFull: false,
        updatedAt: Date.now(),
      });
      const firstRemainingUid = Object.keys(remaining)[0];
      if (firstRemainingUid && playerSnap.val()?.isHost) {
        await update(ref(db, `rooms/${roomCode}/players/${firstRemainingUid}`), {
          isHost: true,
        });
        await update(ref(db, `rooms/${roomCode}/meta`), {
          hostUid: firstRemainingUid,
        });
      }
    }
  }
}

export async function swapDrawerRoles(
  roomCode: string,
  currentDrawerUid: string,
  players: Record<string, PlayerProfile>
) {
  if (!isFirebaseConfigured()) {
    localRoomService.swapLocalDrawerRoles(roomCode);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.swapLocalDrawerRoles(roomCode);
    return;
  }

  const uids = Object.keys(players);
  if (uids.length < 2) return;

  const nextDrawer = uids.find((u) => u !== currentDrawerUid) || uids[0];
  const nextGuesser = currentDrawerUid;

  const gameSnap = await get(ref(db, `rooms/${roomCode}/game`));
  const currentRound = (gameSnap.val()?.currentRound || 0) + 1;

  const updates: Record<string, any> = {
    [`rooms/${roomCode}/game/status`]: 'countdown',
    [`rooms/${roomCode}/game/currentRound`]: currentRound,
    [`rooms/${roomCode}/game/drawerUid`]: nextDrawer,
    [`rooms/${roomCode}/game/guesserUid`]: nextGuesser,
    [`rooms/${roomCode}/game/roundSecretWord`]: null,
    [`rooms/${roomCode}/game/drawerGuessedCorrectly`]: null,
    [`rooms/${roomCode}/game/hintRevealed`]: false,
    [`rooms/${roomCode}/game/initialMask`]: null,
    [`rooms/${roomCode}/game/revealedMask`]: null,
    [`rooms/${roomCode}/game/revealedChar`]: null,
    [`rooms/${roomCode}/game/clearVersion`]: 0,
    [`rooms/${roomCode}/meta/status`]: 'countdown',
  };

  await update(ref(db), updates);
}

export async function startNewRoundDirectly(
  roomCode: string,
  currentDrawerUid: string,
  players: Record<string, PlayerProfile>,
  swapRoles: boolean = true
) {
  if (!isFirebaseConfigured()) {
    localRoomService.startLocalNewRoundDirectly(roomCode, swapRoles);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.startLocalNewRoundDirectly(roomCode, swapRoles);
    return;
  }

  const uids = Object.keys(players);
  if (uids.length < 2) return;

  const nextDrawer = swapRoles ? (uids.find((u) => u !== currentDrawerUid) || uids[0]) : currentDrawerUid;
  const nextGuesser = uids.find((u) => u !== nextDrawer) || uids[0];

  const gameSnap = await get(ref(db, `rooms/${roomCode}/game`));
  const currentRound = (gameSnap.val()?.currentRound || 0) + 1;

  const updates: Record<string, any> = {
    [`rooms/${roomCode}/game/status`]: 'countdown',
    [`rooms/${roomCode}/game/currentRound`]: currentRound,
    [`rooms/${roomCode}/game/drawerUid`]: nextDrawer,
    [`rooms/${roomCode}/game/guesserUid`]: nextGuesser,
    [`rooms/${roomCode}/game/roundSecretWord`]: null,
    [`rooms/${roomCode}/game/drawerGuessedCorrectly`]: null,
    [`rooms/${roomCode}/game/hintRevealed`]: false,
    [`rooms/${roomCode}/game/initialMask`]: null,
    [`rooms/${roomCode}/game/revealedMask`]: null,
    [`rooms/${roomCode}/game/revealedChar`]: null,
    [`rooms/${roomCode}/game/clearVersion`]: 0,
    [`rooms/${roomCode}/meta/status`]: 'countdown',
  };

  await update(ref(db), updates);
}

export async function notifyIncorrectGuess(
  roomCode: string,
  roundId: number,
  message: string = '❌ تخمين خاطئ، حاول مرة ثانية!'
) {
  if (!isFirebaseConfigured()) {
    localRoomService.notifyLocalIncorrectGuess(roomCode, roundId, message);
    return;
  }
  const db = getAppDatabase();
  if (!db) {
    localRoomService.notifyLocalIncorrectGuess(roomCode, roundId, message);
    return;
  }

  const guessesRef = ref(db, `rooms/${roomCode}/guesses/${roundId}`);
  const newGuessRef = push(guessesRef);

  await set(newGuessRef, {
    id: newGuessRef.key,
    uid: 'system',
    playerName: 'الرسام',
    text: message,
    isCorrect: false,
    createdAt: Date.now(),
  });
}

