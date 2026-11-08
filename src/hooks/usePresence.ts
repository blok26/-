import { useEffect, useState } from 'react';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { getAppDatabase, isFirebaseConfigured } from '../services/firebase';
import { PresenceState } from '../types/game';
import * as localRoomService from '../services/localRoomService';

export function usePresence(roomCode: string | null, myUid: string | null) {
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceState>>({});
  const [isConnectedToFirebase, setIsConnectedToFirebase] = useState(true);

  useEffect(() => {
    if (!roomCode || !myUid) return;

    if (!isFirebaseConfigured() || !getAppDatabase()) {
      setIsConnectedToFirebase(true);
      const unsub = localRoomService.subscribeLocalRoom(roomCode, (room) => {
        if (!room || !room.players) {
          setPresenceMap({});
          return;
        }
        const simulatedPresence: Record<string, PresenceState> = {};
        Object.keys(room.players).forEach((uid) => {
          simulatedPresence[uid] = {
            online: true,
            lastSeen: Date.now(),
          };
        });
        setPresenceMap(simulatedPresence);
      });
      return () => unsub();
    }

    const db = getAppDatabase();
    if (!db) return;

    const connectedRef = ref(db, '.info/connected');
    const myPresenceRef = ref(db, `rooms/${roomCode}/presence/${myUid}`);

    const unsubConnected = onValue(connectedRef, (snap) => {
      const isOnline = snap.val() === true;
      setIsConnectedToFirebase(isOnline);

      if (isOnline) {
        onDisconnect(myPresenceRef)
          .set({
            online: false,
            lastSeen: serverTimestamp(),
          })
          .then(() => {
            set(myPresenceRef, {
              online: true,
              lastSeen: serverTimestamp(),
            });
          })
          .catch((err) => {
            console.error('Presence setup error:', err);
          });
      }
    });

    const roomPresenceRef = ref(db, `rooms/${roomCode}/presence`);
    const unsubRoomPresence = onValue(roomPresenceRef, (snap) => {
      const val = snap.val();
      if (val) {
        setPresenceMap(val);
      } else {
        setPresenceMap({});
      }
    });

    return () => {
      unsubConnected();
      unsubRoomPresence();
      set(myPresenceRef, {
        online: false,
        lastSeen: Date.now(),
      }).catch(() => {});
    };
  }, [roomCode, myUid]);

  return { presenceMap, isConnectedToFirebase };
}
