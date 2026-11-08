import React, { useState, useEffect } from 'react';
import {
  Paintbrush,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  Settings,
  HelpCircle,
  AlertCircle,
  Play,
  ArrowLeft,
} from 'lucide-react';
import { isSoundEnabled, setSoundEnabled } from '../utils/soundEffects';
import { isFirebaseConfigured } from '../services/firebase';

interface LobbyProps {
  onCreateRoom: (playerName: string) => Promise<void>;
  onJoinRoom: (roomCode: string, playerName: string) => Promise<void>;
  onOpenFirebaseModal: () => void;
  isLoading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
}

const STORAGE_PLAYER_NAME = 'drawit_player_name';

export const Lobby: React.FC<LobbyProps> = ({
  onCreateRoom,
  onJoinRoom,
  onOpenFirebaseModal,
  isLoading,
  errorMessage,
  onClearError,
}) => {
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem(STORAGE_PLAYER_NAME) || '';
  });
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Auto-fill from URL query param ?room=ABC123
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomCodeInput(roomParam.trim().toUpperCase());
    }
  }, []);

  const handleNameChange = (val: string) => {
    const trimmed = val.slice(0, 20);
    setPlayerName(trimmed);
    localStorage.setItem(STORAGE_PLAYER_NAME, trimmed);
    if (errorMessage) onClearError();
  };

  const handleToggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };

  const handleCreate = async () => {
    if (!playerName.trim()) {
      alert('يرجى كتابة اسمك أولاً!');
      return;
    }
    await onCreateRoom(playerName.trim());
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      alert('يرجى كتابة اسمك أولاً!');
      return;
    }
    const cleanCode = roomCodeInput.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 4) {
      alert('يرجى إدخال رمز الغرفة المكون من 6 خانات!');
      return;
    }
    await onJoinRoom(cleanCode, playerName.trim());
  };

  const hasFirebase = isFirebaseConfigured();

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100/60 via-amber-50 to-orange-50 flex flex-col justify-between p-4 selection:bg-amber-500 selection:text-white">
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between py-2">
        <button
          onClick={handleToggleSound}
          className="p-2.5 bg-white/80 hover:bg-white rounded-2xl border border-amber-200 text-slate-700 shadow-xs transition-colors flex items-center gap-1.5 text-xs font-bold"
          title={soundOn ? 'كتم المؤثرات الصوتية' : 'تفعيل المؤثرات الصوتية'}
          aria-label={soundOn ? 'كتم الصوت' : 'تفعيل الصوت'}
        >
          {soundOn ? <Volume2 className="w-4 h-4 text-amber-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          <span className="hidden sm:inline">{soundOn ? 'الصوت مفعّل' : 'مكتوم'}</span>
        </button>

        <button
          onClick={onOpenFirebaseModal}
          className="p-2.5 bg-white/80 hover:bg-white rounded-2xl border border-amber-200 text-slate-700 shadow-xs transition-colors flex items-center gap-1.5 text-xs font-bold"
          title="إعدادات Firebase (اختياري للربط السحابي)"
          aria-label="إعدادات Firebase"
        >
          <Settings className="w-4 h-4 text-amber-600" />
          <span>{hasFirebase ? 'Firebase سحابي ✓' : 'إعدادات Firebase (اختياري)'}</span>
        </button>
      </div>

      {/* Main Center Card */}
      <div className="max-w-md w-full mx-auto my-auto space-y-6">
        {/* Brand / Logo */}
        <div className="text-center space-y-2">
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-gradient-to-tr from-amber-500 to-orange-400 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-orange-500/20 transform -rotate-3 hover:rotate-0 transition-transform">
              <Paintbrush className="w-10 h-10 text-white drop-shadow-xs" />
            </div>
            <div className="absolute -top-1 -right-1 bg-white p-1 rounded-full shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              ارسمها لو تقدر
            </h1>
            <p className="text-sm font-bold text-amber-800/80 mt-1">
              ارسم، خمّن، واضحكوا مع بعض! 🎨🎙️
            </p>
          </div>
        </div>

        {/* Action Form Container */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-xl border border-amber-200/80 space-y-5">
          {/* Player Name Input */}
          <div className="space-y-1.5 text-right">
            <label className="text-xs font-black text-slate-700 block pr-1">
              اسمك في اللعبة (بحد أقصى 20 حرفًا):
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="اكتب اسمك هنا..."
              maxLength={20}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl text-slate-900 font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 transition-all"
            />
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* Primary Action: Create Room */}
          <button
            onClick={handleCreate}
            disabled={isLoading || !playerName.trim()}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white font-black rounded-2xl text-base shadow-md shadow-orange-500/25 flex items-center justify-center gap-2 transition-all active:scale-98"
          >
            <Sparkles className="w-5 h-5 text-amber-200" />
            <span>{isLoading ? 'جاري التحضير...' : 'إنشاء غرفة جديدة'}</span>
          </button>

          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-xs font-bold text-slate-400 absolute">
              أو انضم لغرفة صديقك
            </span>
          </div>

          {/* Join Room Form */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                dir="ltr"
                value={roomCodeInput}
                onChange={(e) => {
                  setRoomCodeInput(e.target.value.toUpperCase().slice(0, 6));
                  if (errorMessage) onClearError();
                }}
                placeholder="رمز الغرفة (6 خانات)"
                maxLength={6}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white rounded-2xl text-slate-900 font-mono font-black text-center tracking-widest text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 uppercase"
              />
              <button
                onClick={handleJoin}
                disabled={isLoading || !playerName.trim() || roomCodeInput.length < 4}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition-all shadow-md shrink-0 flex items-center gap-1 active:scale-98"
              >
                <span>دخول</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* How to Play Accordion / Button */}
        <div className="bg-white/70 rounded-2xl border border-amber-200/60 p-3">
          <button
            onClick={() => setShowHowToPlay(!showHowToPlay)}
            className="w-full flex items-center justify-between text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <span>طريقة اللعب لشخصين عبر هاتفين</span>
            </div>
            <span className="text-amber-600 font-bold">{showHowToPlay ? 'إخفاء ▲' : 'عرض ▼'}</span>
          </button>

          {showHowToPlay && (
            <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-2 text-right">
              <p>1. أحد اللاعبين يضغط «إنشاء غرفة» ويرسل الكود أو الرابط لصديقه.</p>
              <p>2. اللاعب الثاني يدخل الكود وينضم للغرفة نفسها.</p>
              <p>3. اضغط «تشغيل الميكروفون» للحديث المباشر أثناء اللعب (WebRTC Peer-to-Peer).</p>
              <p>4. الأدوار تتبادل تلقائيًا: أحدهما يرسم والآخر يخمن فورًا بالكتابة!</p>
              <p>5. اللعبة تعاونية، كل تخمين سريع يمنح الفريق نقاطًا إضافية!</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-md w-full mx-auto text-center py-2 text-[11px] text-slate-400 font-medium">
        لعبة عربية لشخصين • اتصال صوتي ومزامنة لحظية
      </footer>
    </div>
  );
};
