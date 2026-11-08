import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCVoiceSession } from '../services/webrtcSignaling';
import { WebRTCCallStatus } from '../types/game';
import { updatePlayerMic } from '../services/roomService';

export function useWebRTC(roomCode: string | null, myUid: string | null, isHost: boolean) {
  const [callStatus, setCallStatus] = useState<WebRTCCallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const sessionRef = useRef<WebRTCVoiceSession | null>(null);

  const joinVoice = useCallback(async () => {
    if (!roomCode || !myUid) return;

    if (sessionRef.current) {
      sessionRef.current.destroy();
    }

    setVoiceError(null);

    const session = new WebRTCVoiceSession(roomCode, myUid, isHost, {
      onStatusChange: (status) => {
        setCallStatus(status);
        if (status === 'connected') {
          updatePlayerMic(roomCode, myUid, true);
        } else if (status === 'disconnected' || status === 'failed') {
          updatePlayerMic(roomCode, myUid, false);
        }
      },
      onVolumeChange: (vol) => {
        setMicVolume(vol);
      },
      onError: (err) => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setVoiceError('تم رفض صلاحية الميكروفون. يرجى تفعيلها من إعدادات المتصفح للاستمتاع بالمحادثة الصوتية.');
        } else {
          setVoiceError('حدث خطأ في الاتصال الصوتي: ' + err.message);
        }
      },
    });

    sessionRef.current = session;

    try {
      await session.start();
    } catch (err: any) {
      console.warn('WebRTC start error:', err);
    }
  }, [roomCode, myUid, isHost]);

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    const muted = sessionRef.current.toggleMute();
    setIsMuted(muted);
    if (roomCode && myUid) {
      updatePlayerMic(roomCode, myUid, !muted);
    }
  }, [roomCode, myUid]);

  const leaveVoice = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.destroy();
      sessionRef.current = null;
    }
    setCallStatus('idle');
    setIsMuted(false);
    setMicVolume(0);
    if (roomCode && myUid) {
      updatePlayerMic(roomCode, myUid, false);
    }
  }, [roomCode, myUid]);

  // Clean up completely when component unmounts or roomCode changes
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }
    };
  }, [roomCode]);

  return {
    callStatus,
    isMuted,
    micVolume,
    voiceError,
    joinVoice,
    toggleMute,
    leaveVoice,
  };
}
