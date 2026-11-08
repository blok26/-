import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Wifi,
  WifiOff,
  LogOut,
  Volume2,
  VolumeX,
  Copy,
  Check,
} from 'lucide-react';
import { WebRTCCallStatus } from '../types/game';
import { isSoundEnabled, setSoundEnabled } from '../utils/soundEffects';

interface GameHeaderProps {
  roomCode: string;
  roundNumber: number;
  totalRounds: number;
  score: number;
  isOnline: boolean;
  callStatus: WebRTCCallStatus;
  isMuted: boolean;
  onToggleMute: () => void;
  onJoinVoice: () => void;
  onLeaveRoom: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  roomCode,
  roundNumber,
  totalRounds,
  score,
  isOnline,
  callStatus,
  isMuted,
  onToggleMute,
  onJoinVoice,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const getCallStatusBadge = () => {
    switch (callStatus) {
      case 'connected':
        return (
          <button
            onClick={onToggleMute}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
              isMuted
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
            }`}
            title={isMuted ? 'الميكروفون مكتوم، اضغط لإلغاء الكتم' : 'متصل صوتيًا، اضغط للكتم'}
            aria-label={isMuted ? 'إلغاء كتم الميكروفون' : 'كتم الميكروفون'}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'مكتوم' : 'صوت مباشر'}</span>
          </button>
        );
      case 'connecting':
      case 'requesting_permissions':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
            <PhoneCall className="w-3.5 h-3.5 animate-spin" />
            <span>جاري الاتصال...</span>
          </span>
        );
      case 'failed':
        return (
          <button
            onClick={onJoinVoice}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700 hover:bg-rose-200"
            aria-label="إعادة محاولة الصوت"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>إعادة الصوت</span>
          </button>
        );
      default:
        return (
          <button
            onClick={onJoinVoice}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
            title="انضم للمحادثة الصوتية"
            aria-label="انضم للصوت"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>تشغيل الصوت</span>
          </button>
        );
    }
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-amber-200/80 px-3 py-2 sticky top-0 z-30 shadow-xs">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Room code & connection */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 px-2 py-1 bg-amber-100/70 hover:bg-amber-200 text-amber-900 rounded-lg text-xs font-bold font-mono transition-colors"
            title="انقر لنسخ كود الغرفة"
            aria-label="نسخ كود الغرفة"
          >
            <span>{roomCode}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-700" />}
          </button>

          <span
            className="flex items-center text-xs"
            title={isOnline ? 'متصل بالخادم' : 'غير متصل بالإنترنت'}
          >
            {isOnline ? (
              <Wifi className="w-4 h-4 text-emerald-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-500 animate-pulse" />
            )}
          </span>
        </div>

        {/* Center: Round & Score */}
        <div className="flex items-center gap-3">
          {roundNumber > 0 && (
            <div className="text-center">
              <span className="text-[11px] text-slate-500 block leading-tight font-medium">الجولة</span>
              <span className="text-sm font-black text-indigo-700">
                {roundNumber} <span className="text-xs font-normal text-slate-400">/ {totalRounds}</span>
              </span>
            </div>
          )}

          <div className="text-center bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
            <span className="text-[10px] text-amber-800 block leading-tight font-bold">النقاط</span>
            <span className="text-sm font-black text-amber-900">{score}</span>
          </div>
        </div>

        {/* Right: Audio badge & controls */}
        <div className="flex items-center gap-1.5">
          {getCallStatusBadge()}

          <button
            onClick={handleToggleSound}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title={soundOn ? 'كتم المؤثرات الصوتية' : 'تفعيل المؤثرات الصوتية'}
            aria-label={soundOn ? 'كتم الصوت' : 'تفعيل الصوت'}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-rose-500" />}
          </button>

          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
            title="مغادرة الغرفة"
            aria-label="مغادرة الغرفة"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full mx-auto flex items-center justify-center">
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">هل تريد مغادرة الغرفة؟</h3>
              <p className="text-xs text-slate-500 mt-1">
                سيتم إيقاف الميكروفون وخروجك من الجولة الحالية.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowLeaveConfirm(false);
                  onLeaveRoom();
                }}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-colors"
              >
                نعم، غادر
              </button>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
