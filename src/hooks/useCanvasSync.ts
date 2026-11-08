import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ref,
  set,
  push,
  update,
  onChildAdded,
  onChildChanged,
  off,
} from 'firebase/database';
import { getAppDatabase, isFirebaseConfigured } from '../services/firebase';
import { FullStroke, StrokeMeta, StrokePoint, StrokeChunk } from '../types/game';
import * as localRoomService from '../services/localRoomService';

interface UseCanvasSyncProps {
  roomCode: string;
  roundId: number;
  isDrawer: boolean;
  drawerUid: string;
  myUid: string;
  clearVersion: number;
}

export function useCanvasSync({
  roomCode,
  roundId,
  isDrawer,
  drawerUid,
  myUid,
  clearVersion,
}: UseCanvasSyncProps) {
  const [strokes, setStrokes] = useState<FullStroke[]>([]);
  const strokesRef = useRef<FullStroke[]>([]);
  strokesRef.current = strokes;

  // Active stroke buffer for drawer chunking (40-60ms intervals)
  const activeStrokeIdRef = useRef<string | null>(null);
  const pointBufferRef = useRef<StrokePoint[]>([]);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync strokes from Firebase or Local Engine
  useEffect(() => {
    if (!roomCode || roundId <= 0) {
      setStrokes([]);
      return;
    }

    setStrokes([]);

    if (!isFirebaseConfigured() || !getAppDatabase()) {
      const unsub = localRoomService.subscribeLocalCanvas(roomCode, roundId, (list) => {
        setStrokes(list);
      });
      return () => unsub();
    }

    const db = getAppDatabase();
    if (!db) return;

    const strokesRefNode = ref(db, `rooms/${roomCode}/canvas/${roundId}/strokes`);

    // 1. Listen for new strokes
    onChildAdded(strokesRefNode, (strokeSnap) => {
      const strokeId = strokeSnap.key;
      if (!strokeId) return;

      const meta = strokeSnap.child('meta').val() as StrokeMeta | null;
      if (!meta) return;

      const chunksSnap = strokeSnap.child('chunks');
      const allPoints: StrokePoint[] = [];

      chunksSnap.forEach((chunkChild) => {
        const chunk = chunkChild.val() as StrokeChunk | StrokePoint[];
        if (Array.isArray(chunk)) {
          allPoints.push(...chunk);
        } else if (chunk && Array.isArray((chunk as any).points)) {
          allPoints.push(...(chunk as any).points);
        }
      });

      setStrokes((prev) => {
        const exists = prev.find((s) => s.meta.strokeId === strokeId);
        if (exists) {
          return prev.map((s) =>
            s.meta.strokeId === strokeId
              ? { ...s, meta, points: s.points.length > 0 ? s.points : allPoints }
              : s
          );
        }
        return [...prev, { meta, points: allPoints }];
      });

      // 2. Listen to real-time incoming chunks for this stroke
      const chunksRef = ref(db, `rooms/${roomCode}/canvas/${roundId}/strokes/${strokeId}/chunks`);
      onChildAdded(chunksRef, (chunkSnap) => {
        const val = chunkSnap.val();
        let newPts: StrokePoint[] = [];
        if (Array.isArray(val)) {
          newPts = val;
        } else if (val && Array.isArray(val.points)) {
          newPts = val.points;
        }

        if (newPts.length > 0) {
          setStrokes((prev) =>
            prev.map((s) => {
              if (s.meta.strokeId === strokeId) {
                if (isDrawer && s.meta.drawerUid === myUid) {
                  return s;
                }
                return { ...s, points: [...s.points, ...newPts] };
              }
              return s;
            })
          );
        }
      });
    });

    // 3. Listen for stroke metadata changes (undo)
    onChildChanged(strokesRefNode, (strokeSnap) => {
      const strokeId = strokeSnap.key;
      const meta = strokeSnap.child('meta').val() as StrokeMeta | null;
      if (strokeId && meta) {
        setStrokes((prev) =>
          prev.map((s) => (s.meta.strokeId === strokeId ? { ...s, meta } : s))
        );
      }
    });

    return () => {
      off(strokesRefNode);
    };
  }, [roomCode, roundId, isDrawer, myUid]);

  // Handle clearVersion changes
  const prevClearVersionRef = useRef(clearVersion);
  useEffect(() => {
    if (clearVersion > prevClearVersionRef.current) {
      setStrokes([]);
      prevClearVersionRef.current = clearVersion;
    }
  }, [clearVersion]);

  // Flush points buffer
  const flushChunkBuffer = useCallback(() => {
    const strokeId = activeStrokeIdRef.current;
    if (!strokeId || pointBufferRef.current.length === 0) return;

    const pointsToSend = [...pointBufferRef.current];
    pointBufferRef.current = [];

    if (!isFirebaseConfigured() || !getAppDatabase()) {
      localRoomService.appendLocalStrokePoints(roomCode, roundId, strokeId, pointsToSend);
      return;
    }

    const db = getAppDatabase();
    if (!db) return;

    const chunkRef = push(ref(db, `rooms/${roomCode}/canvas/${roundId}/strokes/${strokeId}/chunks`));
    set(chunkRef, { points: pointsToSend }).catch(console.error);
  }, [roomCode, roundId]);

  // Start new stroke (called on pointerdown)
  const startStroke = useCallback(
    async (color: string, size: number, isEraser: boolean, startPoint: StrokePoint) => {
      if (!isDrawer) return;

      flushChunkBuffer();
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);

      const strokeId = `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      activeStrokeIdRef.current = strokeId;

      const meta: StrokeMeta = {
        strokeId,
        color: isEraser ? '#ffffff' : color,
        size,
        isEraser,
        createdAt: Date.now(),
        drawerUid: myUid,
        deleted: false,
      };

      // Optimistic local state update for immediate responsive drawing
      setStrokes((prev) => [...prev, { meta, points: [startPoint] }]);

      if (!isFirebaseConfigured() || !getAppDatabase()) {
        localRoomService.addLocalStroke(roomCode, roundId, meta, startPoint);
        pointBufferRef.current = [startPoint];
        chunkTimerRef.current = setInterval(() => {
          flushChunkBuffer();
        }, 50);
        return;
      }

      const db = getAppDatabase();
      if (!db) return;

      await set(ref(db, `rooms/${roomCode}/canvas/${roundId}/strokes/${strokeId}/meta`), meta);

      pointBufferRef.current = [startPoint];
      chunkTimerRef.current = setInterval(() => {
        flushChunkBuffer();
      }, 50);
    },
    [isDrawer, roomCode, roundId, myUid, flushChunkBuffer]
  );

  // Append point to active stroke (called on pointermove)
  const appendPoint = useCallback(
    (point: StrokePoint) => {
      if (!isDrawer || !activeStrokeIdRef.current) return;

      pointBufferRef.current.push(point);

      const strokeId = activeStrokeIdRef.current;
      setStrokes((prev) =>
        prev.map((s) =>
          s.meta.strokeId === strokeId ? { ...s, points: [...s.points, point] } : s
        )
      );
    },
    [isDrawer]
  );

  // End stroke (called on pointerup/leave)
  const endStroke = useCallback(() => {
    if (!isDrawer || !activeStrokeIdRef.current) return;

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    flushChunkBuffer();
    activeStrokeIdRef.current = null;
  }, [isDrawer, flushChunkBuffer]);

  // Undo last stroke by drawer
  const undoLastStroke = useCallback(async () => {
    if (!isDrawer) return;

    if (!isFirebaseConfigured() || !getAppDatabase()) {
      localRoomService.undoLocalStroke(roomCode, roundId, myUid);
      return;
    }

    const db = getAppDatabase();
    if (!db) return;

    const validStrokes = strokesRef.current.filter((s) => !s.meta.deleted && s.meta.drawerUid === myUid);
    if (validStrokes.length === 0) return;

    const lastStroke = validStrokes[validStrokes.length - 1];

    await update(
      ref(db, `rooms/${roomCode}/canvas/${roundId}/strokes/${lastStroke.meta.strokeId}/meta`),
      { deleted: true }
    );

    setStrokes((prev) =>
      prev.map((s) =>
        s.meta.strokeId === lastStroke.meta.strokeId
          ? { ...s, meta: { ...s.meta, deleted: true } }
          : s
      )
    );
  }, [isDrawer, roomCode, roundId, myUid]);

  // Clear canvas
  const clearCanvas = useCallback(async () => {
    if (!isDrawer) return;

    if (!isFirebaseConfigured() || !getAppDatabase()) {
      localRoomService.clearLocalCanvas(roomCode, roundId);
      setStrokes([]);
      return;
    }

    const db = getAppDatabase();
    if (!db) return;

    const newClearVer = (clearVersion || 0) + 1;
    await update(ref(db, `rooms/${roomCode}/game`), {
      clearVersion: newClearVer,
    });
    await set(ref(db, `rooms/${roomCode}/canvas/${roundId}`), null);
    setStrokes([]);
  }, [isDrawer, roomCode, roundId, clearVersion]);

  return {
    strokes,
    startStroke,
    appendPoint,
    endStroke,
    undoLastStroke,
    clearCanvas,
  };
}
