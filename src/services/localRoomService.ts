import { RoomSettings, PlayerProfile, GameState, GuessMessage, GameResults, FullStroke, StrokeMeta, StrokePoint } from '../types/game';
import { ArabicWord, isArabicGuessCorrect, generateWordHint } from '../utils/normalizeArabic';
import { getRandomWord } from '../data/arabicWords';

export interface LocalRoomData {
  meta: {
    roomCode: string;
    hostUid: string;
    status: string;
    playerCount: number;
    isFull: boolean;
    createdAt: number;
    updatedAt: number;
  };
  settings: RoomSettings;
  players: Record<string, PlayerProfile>;
  game: GameState;
  guesses: Record<number, Record<string, GuessMessage>>;
  strokes: Record<number, Record<string, FullStroke>>;
  results?: GameResults | null;
}

const LOCAL_STORAGE_PREFIX = 'drawit_room_data_';
const channel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('drawit_local_sync')
  : null;

// In-memory active listeners
type RoomListener = (room: LocalRoomData | null) => void;
type GuessesListener = (guesses: GuessMessage[]) => void;
type CanvasListener = (strokes: FullStroke[]) => void;

const roomListeners = new Map<string, Set<RoomListener>>();
const guessesListeners = new Map<string, Set<GuessesListener>>();
const canvasListeners = new Map<string, Set<CanvasListener>>();

function getStorageKey(code: string): string {
  return `${LOCAL_STORAGE_PREFIX}${code.toUpperCase()}`;
}

export function getLocalRoom(roomCode: string): LocalRoomData | null {
  try {
    const raw = localStorage.getItem(getStorageKey(roomCode));
    if (!raw) return null;
    return JSON.parse(raw) as LocalRoomData;
  } catch (e) {
    console.error('Failed to get local room:', e);
    return null;
  }
}

export function saveLocalRoom(room: LocalRoomData): void {
  try {
    room.meta.updatedAt = Date.now();
    localStorage.setItem(getStorageKey(room.meta.roomCode), JSON.stringify(room));
    notifyRoomChange(room.meta.roomCode, room);

    // Broadcast to other tabs
    if (channel) {
      channel.postMessage({
        type: 'ROOM_UPDATE',
        roomCode: room.meta.roomCode,
        room,
      });
    }
  } catch (e) {
    console.error('Failed to save local room:', e);
  }
}

function notifyRoomChange(roomCode: string, room: LocalRoomData | null) {
  const set = roomListeners.get(roomCode.toUpperCase());
  if (set) {
    setTimeout(() => {
      set.forEach((listener) => {
        try {
          listener(room);
        } catch (e) {
          console.error('Error in room listener:', e);
        }
      });
    }, 0);
  }
}

function notifyGuessesChange(roomCode: string, roundId: number) {
  const key = `${roomCode.toUpperCase()}_${roundId}`;
  const set = guessesListeners.get(key);
  if (set) {
    setTimeout(() => {
      const room = getLocalRoom(roomCode);
      const roundGuesses = room?.guesses?.[roundId] || {};
      const list = Object.values(roundGuesses).sort((a, b) => a.createdAt - b.createdAt);
      set.forEach((listener) => {
        try {
          listener(list);
        } catch (e) {
          console.error('Error in guess listener:', e);
        }
      });
    }, 0);
  }
}

function notifyCanvasChange(roomCode: string, roundId: number) {
  const key = `${roomCode.toUpperCase()}_${roundId}`;
  const set = canvasListeners.get(key);
  if (set) {
    setTimeout(() => {
      const room = getLocalRoom(roomCode);
      const roundStrokes = room?.strokes?.[roundId] || {};
      const list = Object.values(roundStrokes);
      set.forEach((listener) => {
        try {
          listener(list);
        } catch (e) {
          console.error('Error in canvas listener:', e);
        }
      });
    }, 0);
  }
}

// Listen to cross-tab updates
if (channel) {
  channel.onmessage = (event) => {
    const data = event.data;
    if (!data) return;

    if (data.type === 'ROOM_UPDATE' && data.roomCode) {
      notifyRoomChange(data.roomCode, data.room);
    } else if (data.type === 'GUESSES_UPDATE' && data.roomCode) {
      notifyGuessesChange(data.roomCode, data.roundId);
    } else if (data.type === 'CANVAS_UPDATE' && data.roomCode) {
      notifyCanvasChange(data.roomCode, data.roundId);
    }
  };
}

export function subscribeLocalRoom(roomCode: string, callback: RoomListener): () => void {
  const cleanCode = roomCode.toUpperCase();
  if (!roomListeners.has(cleanCode)) {
    roomListeners.set(cleanCode, new Set());
  }
  roomListeners.get(cleanCode)!.add(callback);

  // Initial push
  callback(getLocalRoom(cleanCode));

  return () => {
    const set = roomListeners.get(cleanCode);
    if (set) {
      set.delete(callback);
      if (set.size === 0) roomListeners.delete(cleanCode);
    }
  };
}

export function subscribeLocalGuesses(roomCode: string, roundId: number, callback: GuessesListener): () => void {
  const key = `${roomCode.toUpperCase()}_${roundId}`;
  if (!guessesListeners.has(key)) {
    guessesListeners.set(key, new Set());
  }
  guessesListeners.get(key)!.add(callback);

  // Initial push
  const room = getLocalRoom(roomCode);
  const roundGuesses = room?.guesses?.[roundId] || {};
  const list = Object.values(roundGuesses).sort((a, b) => a.createdAt - b.createdAt);
  callback(list);

  return () => {
    const set = guessesListeners.get(key);
    if (set) {
      set.delete(callback);
      if (set.size === 0) guessesListeners.delete(key);
    }
  };
}

export function subscribeLocalCanvas(roomCode: string, roundId: number, callback: CanvasListener): () => void {
  const key = `${roomCode.toUpperCase()}_${roundId}`;
  if (!canvasListeners.has(key)) {
    canvasListeners.set(key, new Set());
  }
  canvasListeners.get(key)!.add(callback);

  // Initial push
  const room = getLocalRoom(roomCode);
  const roundStrokes = room?.strokes?.[roundId] || {};
  const list = Object.values(roundStrokes);
  callback(list);

  return () => {
    const set = canvasListeners.get(key);
    if (set) {
      set.delete(callback);
      if (set.size === 0) canvasListeners.delete(key);
    }
  };
}

// ----------------- Room Operations -----------------

export function createLocalRoom(
  code: string,
  hostUid: string,
  hostName: string,
  avatarColor: string,
  settings?: Partial<RoomSettings>
): string {
  const defaultSettings: RoomSettings = {
    roundsCount: 8,
    roundDurationSec: 60,
    difficulty: 'mixed',
    ...settings,
  };

  const newRoom: LocalRoomData = {
    meta: {
      roomCode: code,
      hostUid,
      status: 'lobby',
      playerCount: 1,
      isFull: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    settings: defaultSettings,
    players: {
      [hostUid]: {
        uid: hostUid,
        name: hostName.trim().slice(0, 20),
        avatarColor,
        isHost: true,
        ready: true,
        micEnabled: false,
        joinedAt: Date.now(),
      },
    },
    game: {
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
    },
    guesses: {},
    strokes: {},
    results: null,
  };

  saveLocalRoom(newRoom);
  return code;
}

export function joinLocalRoom(
  roomCode: string,
  playerUid: string,
  playerName: string,
  avatarColor: string
): { isHost: boolean } {
  const room = getLocalRoom(roomCode);
  if (!room) {
    throw new Error('رمز الغرفة غير موجود. تأكد من إدخال 6 أحرف صحيحة.');
  }

  const currentUids = Object.keys(room.players);
  if (currentUids.includes(playerUid)) {
    room.players[playerUid].name = playerName.trim().slice(0, 20);
    room.players[playerUid].avatarColor = avatarColor;
    saveLocalRoom(room);
    return { isHost: room.players[playerUid].isHost };
  }

  if (currentUids.length >= 2) {
    throw new Error('عذرًا، الغرفة ممتلئة! الحد الأقصى هو لاعبان اثنان فقط.');
  }

  const isHost = currentUids.length === 0;
  room.players[playerUid] = {
    uid: playerUid,
    name: playerName.trim().slice(0, 20),
    avatarColor,
    isHost,
    ready: false,
    micEnabled: false,
    joinedAt: Date.now(),
  };

  room.meta.playerCount = Object.keys(room.players).length;
  room.meta.isFull = room.meta.playerCount >= 2;
  saveLocalRoom(room);

  return { isHost };
}

export function addSimulatedPlayer(roomCode: string): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const botUid = 'simulated_player_fahad';
  room.players[botUid] = {
    uid: botUid,
    name: 'فهد (تجريبي) 🤖',
    avatarColor: '#10b981',
    isHost: false,
    ready: true,
    micEnabled: true,
    joinedAt: Date.now(),
  };

  room.meta.playerCount = Object.keys(room.players).length;
  room.meta.isFull = room.meta.playerCount >= 2;
  saveLocalRoom(room);
}

export function updateLocalRoomSettings(roomCode: string, settings: Partial<RoomSettings>): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  room.settings = { ...room.settings, ...settings };
  if (settings.roundsCount !== undefined) {
    room.game.totalRounds = settings.roundsCount;
  }
  saveLocalRoom(room);
}

export function toggleLocalPlayerReady(roomCode: string, uid: string, ready: boolean): void {
  const room = getLocalRoom(roomCode);
  if (!room || !room.players[uid]) return;

  room.players[uid].ready = ready;
  saveLocalRoom(room);
}

export function updateLocalPlayerMic(roomCode: string, uid: string, micEnabled: boolean): void {
  const room = getLocalRoom(roomCode);
  if (!room || !room.players[uid]) return;

  room.players[uid].micEnabled = micEnabled;
  saveLocalRoom(room);
}

export function startLocalGameCountdown(roomCode: string): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const uids = Object.keys(room.players);
  if (uids.length < 2) {
    throw new Error('يجب تواجد لاعبين اثنين لبدء اللعبة!');
  }

  const hostUid = uids.find((u) => room.players[u].isHost) || uids[0];
  const guesserUid = uids.find((u) => u !== hostUid) || uids[1];

  room.game.status = 'countdown';
  room.game.currentRound = 1;
  room.game.totalRounds = room.settings.roundsCount;
  room.game.drawerUid = hostUid;
  room.game.guesserUid = guesserUid;
  room.game.roundStartedAt = 0;
  room.game.roundDurationSec = room.settings.roundDurationSec;
  room.game.score = 0;
  room.game.correctRounds = 0;
  room.game.clearVersion = 0;

  room.meta.status = 'countdown';
  saveLocalRoom(room);
}

export function startLocalDrawingRound(
  roomCode: string,
  roundNumber: number,
  drawerUid: string,
  guesserUid: string,
  secretWord: ArabicWord,
  durationSec: number
): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const hint = generateWordHint(secretWord.displayWord);

  room.game.status = 'drawing';
  room.game.currentRound = roundNumber;
  room.game.drawerUid = drawerUid;
  room.game.guesserUid = guesserUid;
  room.game.roundStartedAt = Date.now();
  room.game.roundDurationSec = durationSec;
  room.game.secretCategory = secretWord.category;
  room.game.secretLength = hint.letterCount;
  room.game.wordCount = hint.wordCount;
  room.game.initialMask = hint.initialMask;
  room.game.revealedMask = hint.revealedMask;
  room.game.revealedChar = hint.revealedChar;
  room.game.hintRevealed = false;
  room.game.roundSecretWord = undefined;
  room.game.clearVersion = 0;

  room.meta.status = 'drawing';
  saveLocalRoom(room);
}

export function revealLocalRoundHint(roomCode: string): void {
  const room = getLocalRoom(roomCode);
  if (!room || room.game.status !== 'drawing') return;

  room.game.hintRevealed = true;
  saveLocalRoom(room);
}

export function submitLocalGuess(
  roomCode: string,
  roundId: number,
  uid: string,
  playerName: string,
  text: string
): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const cleanText = text.trim().slice(0, 80);
  if (!cleanText) return;

  if (!room.guesses) room.guesses = {};
  if (!room.guesses[roundId]) room.guesses[roundId] = {};

  const guessId = `guess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  room.guesses[roundId][guessId] = {
    id: guessId,
    uid,
    playerName,
    text: cleanText,
    isCorrect: false,
    createdAt: Date.now(),
  };

  saveLocalRoom(room);
  notifyGuessesChange(roomCode, roundId);

  if (channel) {
    channel.postMessage({
      type: 'GUESSES_UPDATE',
      roomCode,
      roundId,
    });
  }
}

export function finishLocalRoundWithSuccess(
  roomCode: string,
  roundId: number,
  guessId: string | null,
  secretWord: ArabicWord,
  remainingSeconds: number,
  currentScore: number,
  correctCount: number
): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const roundPoints = 100 + Math.max(0, Math.floor(remainingSeconds * 2));
  const newScore = currentScore + roundPoints;
  const newCorrect = correctCount + 1;

  room.game.status = 'roundResult';
  room.game.roundSecretWord = secretWord.displayWord;
  room.game.score = newScore;
  room.game.correctRounds = newCorrect;
  room.game.drawerGuessedCorrectly = true;
  room.game.roundEndedAt = Date.now();
  room.meta.status = 'roundResult';

  if (guessId && room.guesses?.[roundId]?.[guessId]) {
    room.guesses[roundId][guessId].isCorrect = true;
  }

  saveLocalRoom(room);
}

export function finishLocalRoundWithTimeout(roomCode: string, secretWordDisplay: string): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  room.game.status = 'roundResult';
  room.game.roundSecretWord = secretWordDisplay;
  room.game.drawerGuessedCorrectly = false;
  room.game.roundEndedAt = Date.now();
  room.meta.status = 'roundResult';

  saveLocalRoom(room);
}

export function transitionLocalToNextRoundOrGameOver(
  roomCode: string,
  currentRound: number,
  totalRounds: number,
  currentDrawerUid: string,
  players: Record<string, PlayerProfile>
): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const uids = Object.keys(players);
  if (currentRound >= totalRounds) {
    const totalScore = room.game.score || 0;
    const correctCount = room.game.correctRounds || 0;
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

    room.game.status = 'gameOver';
    room.meta.status = 'gameOver';
    room.results = results;
    saveLocalRoom(room);
  } else {
    const nextRound = currentRound + 1;
    const nextDrawerUid = uids.find((u) => u !== currentDrawerUid) || currentDrawerUid;
    const nextGuesserUid = uids.find((u) => u === currentDrawerUid) || uids[0];

    room.game.status = 'countdown';
    room.game.currentRound = nextRound;
    room.game.drawerUid = nextDrawerUid;
    room.game.guesserUid = nextGuesserUid;
    room.game.roundSecretWord = undefined;
    room.game.drawerGuessedCorrectly = undefined;
    room.game.clearVersion = 0;
    room.meta.status = 'countdown';

    saveLocalRoom(room);
  }
}

export function resetLocalGameToLobby(roomCode: string, totalRounds: number, durationSec: number): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  room.game.status = 'lobby';
  room.game.currentRound = 0;
  room.game.score = 0;
  room.game.correctRounds = 0;
  room.game.roundSecretWord = undefined;
  room.meta.status = 'lobby';
  room.strokes = {};
  room.guesses = {};
  room.results = null;

  saveLocalRoom(room);
}

export function leaveLocalRoom(roomCode: string, uid: string): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  delete room.players[uid];
  const remaining = Object.keys(room.players);
  if (remaining.length === 0) {
    localStorage.removeItem(getStorageKey(roomCode));
    notifyRoomChange(roomCode, null);
  } else {
    room.meta.playerCount = remaining.length;
    room.meta.isFull = false;
    if (room.players[remaining[0]]) {
      room.players[remaining[0]].isHost = true;
      room.meta.hostUid = remaining[0];
    }
    saveLocalRoom(room);
  }
}

export function swapLocalDrawerRoles(roomCode: string): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const uids = Object.keys(room.players);
  if (uids.length < 2) return;

  const currentDrawer = room.game.drawerUid || uids[0];
  const newDrawer = uids.find((u) => u !== currentDrawer) || uids[0];
  const newGuesser = currentDrawer;

  room.game.status = 'countdown';
  room.game.currentRound = (room.game.currentRound || 0) + 1;
  room.game.drawerUid = newDrawer;
  room.game.guesserUid = newGuesser;
  room.game.roundSecretWord = undefined;
  room.game.drawerGuessedCorrectly = undefined;
  room.game.hintRevealed = false;
  room.game.initialMask = undefined;
  room.game.revealedMask = undefined;
  room.game.revealedChar = undefined;
  room.game.clearVersion = 0;
  room.meta.status = 'countdown';

  saveLocalRoom(room);
}

export function startLocalNewRoundDirectly(roomCode: string, swapRoles: boolean = true): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  const uids = Object.keys(room.players);
  if (uids.length < 2) return;

  const currentDrawer = room.game.drawerUid || uids[0];
  const nextDrawer = swapRoles ? (uids.find((u) => u !== currentDrawer) || uids[0]) : currentDrawer;
  const nextGuesser = uids.find((u) => u !== nextDrawer) || uids[0];

  room.game.status = 'countdown';
  room.game.currentRound = (room.game.currentRound || 0) + 1;
  room.game.drawerUid = nextDrawer;
  room.game.guesserUid = nextGuesser;
  room.game.roundSecretWord = undefined;
  room.game.drawerGuessedCorrectly = undefined;
  room.game.hintRevealed = false;
  room.game.initialMask = undefined;
  room.game.revealedMask = undefined;
  room.game.revealedChar = undefined;
  room.game.clearVersion = 0;
  room.meta.status = 'countdown';

  saveLocalRoom(room);
}

export function notifyLocalIncorrectGuess(roomCode: string, roundId: number, message: string = '❌ تخمين خاطئ، حاول مرة ثانية!'): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  if (!room.guesses) room.guesses = {};
  if (!room.guesses[roundId]) room.guesses[roundId] = {};

  const id = `sys_${Date.now()}`;
  room.guesses[roundId][id] = {
    id,
    uid: 'system',
    playerName: 'الرسام',
    text: message,
    isCorrect: false,
    createdAt: Date.now(),
  };

  saveLocalRoom(room);
  notifyGuessesChange(roomCode, roundId);

  if (channel) {
    channel.postMessage({
      type: 'GUESSES_UPDATE',
      roomCode,
      roundId,
    });
  }
}

// ----------------- Canvas Operations -----------------

export function addLocalStroke(roomCode: string, roundId: number, meta: StrokeMeta, initialPoint: StrokePoint): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  if (!room.strokes) room.strokes = {};
  if (!room.strokes[roundId]) room.strokes[roundId] = {};

  room.strokes[roundId][meta.strokeId] = {
    meta,
    points: [initialPoint],
  };

  saveLocalRoom(room);
  notifyCanvasChange(roomCode, roundId);

  if (channel) {
    channel.postMessage({
      type: 'CANVAS_UPDATE',
      roomCode,
      roundId,
    });
  }
}

export function appendLocalStrokePoints(roomCode: string, roundId: number, strokeId: string, points: StrokePoint[]): void {
  const room = getLocalRoom(roomCode);
  if (!room || !room.strokes?.[roundId]?.[strokeId]) return;

  room.strokes[roundId][strokeId].points.push(...points);
  saveLocalRoom(room);
  notifyCanvasChange(roomCode, roundId);

  if (channel) {
    channel.postMessage({
      type: 'CANVAS_UPDATE',
      roomCode,
      roundId,
    });
  }
}

export function undoLocalStroke(roomCode: string, roundId: number, drawerUid: string): void {
  const room = getLocalRoom(roomCode);
  if (!room || !room.strokes?.[roundId]) return;

  const list = Object.values(room.strokes[roundId]).filter(
    (s) => !s.meta.deleted && s.meta.drawerUid === drawerUid
  );
  if (list.length === 0) return;

  const lastStroke = list[list.length - 1];
  lastStroke.meta.deleted = true;

  saveLocalRoom(room);
  notifyCanvasChange(roomCode, roundId);

  if (channel) {
    channel.postMessage({
      type: 'CANVAS_UPDATE',
      roomCode,
      roundId,
    });
  }
}

export function clearLocalCanvas(roomCode: string, roundId: number): void {
  const room = getLocalRoom(roomCode);
  if (!room) return;

  if (!room.strokes) room.strokes = {};
  room.strokes[roundId] = {};
  room.game.clearVersion = (room.game.clearVersion || 0) + 1;

  saveLocalRoom(room);
  notifyCanvasChange(roomCode, roundId);

  if (channel) {
    channel.postMessage({
      type: 'CANVAS_UPDATE',
      roomCode,
      roundId,
    });
  }
}
