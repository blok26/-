import React, { useState, useEffect } from 'react';
import { Lobby } from './components/Lobby';
import { Room } from './components/Room';
import { FirebaseSetupModal } from './components/FirebaseSetupModal';
import { getOrCreateUserUid } from './services/firebase';
import { createRoom, joinRoom, getRandomAvatarColor } from './services/roomService';

const ACTIVE_ROOM_SESSION_KEY = 'drawit_active_room';

export default function App() {
  const [myUid, setMyUid] = useState<string | null>(null);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(() => {
    return sessionStorage.getItem(ACTIVE_ROOM_SESSION_KEY) || null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showFirebaseModal, setShowFirebaseModal] = useState(false);

  // Initialize player UID immediately (works instantly with or without Firebase)
  useEffect(() => {
    getOrCreateUserUid()
      .then((uid) => setMyUid(uid))
      .catch((err) => {
        console.warn('User UID initialization warning:', err);
      });
  }, []);

  const handleCreateRoom = async (playerName: string) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      let uid = myUid;
      if (!uid) {
        uid = await getOrCreateUserUid();
        setMyUid(uid);
      }

      const avatarColor = getRandomAvatarColor();
      // Directly create room and generate room code ABC123 immediately
      const code = await createRoom(uid, playerName, avatarColor);

      sessionStorage.setItem(ACTIVE_ROOM_SESSION_KEY, code);
      setActiveRoomCode(code);
    } catch (err: any) {
      console.error('Create room error:', err);
      setErrorMessage(err.message || 'تعذر إنشاء الغرفة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (code: string, playerName: string) => {
    setErrorMessage(null);
    setIsLoading(true);

    try {
      let uid = myUid;
      if (!uid) {
        uid = await getOrCreateUserUid();
        setMyUid(uid);
      }

      const avatarColor = getRandomAvatarColor();
      await joinRoom(code, uid, playerName, avatarColor);

      sessionStorage.setItem(ACTIVE_ROOM_SESSION_KEY, code);
      setActiveRoomCode(code);
    } catch (err: any) {
      console.error('Join room error:', err);
      setErrorMessage(err.message || 'تعذر الانضمام للغرفة. تأكد من صحة الرمز.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitRoom = () => {
    sessionStorage.removeItem(ACTIVE_ROOM_SESSION_KEY);
    setActiveRoomCode(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="font-sans antialiased text-slate-800">
      {activeRoomCode && myUid ? (
        <Room
          roomCode={activeRoomCode}
          myUid={myUid}
          onExitRoom={handleExitRoom}
        />
      ) : (
        <Lobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenFirebaseModal={() => setShowFirebaseModal(true)}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />
      )}

      {/* Firebase Setup Modal (Purely Optional Side Setting) */}
      <FirebaseSetupModal
        isOpen={showFirebaseModal}
        onClose={() => setShowFirebaseModal(false)}
      />
    </div>
  );
}
