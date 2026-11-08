import React, { useEffect, useState } from 'react';
import { Clock, PartyPopper, ArrowLeft, RefreshCw, Sparkles } from 'lucide-react';
import { playSuccessChime, playTimeoutTone } from '../utils/soundEffects';

interface RoundResultProps {
  roundNumber: number;
  totalRounds: number;
  secretWord: string;
  category: string;
  drawerName: string;
  guesserName: string;
  isSuccess: boolean;
  score: number;
  onNextRound: () => void;
  onSwapDrawer?: () => void;
  isHost: boolean;
}

export const RoundResult: React.FC<RoundResultProps> = ({
  roundNumber,
  totalRounds,
  secretWord,
  category,
  drawerName,
  guesserName,
  isSuccess,
  score,
  onNextRound,
  onSwapDrawer,
  isHost,
}) => {
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    if (isSuccess) {
      playSuccessChime();
    } else {
      playTimeoutTone();
    }

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isSuccess]);

  useEffect(() => {
    if (countdown === 0 && isHost) {
      const timer = setTimeout(() => {
        onNextRound();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [countdown, isHost, onNextRound]);

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-amber-300 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
        {/* Status Icon */}
        <div
          className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center shadow-lg ${
            isSuccess
              ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white'
              : 'bg-gradient-to-tr from-amber-500 to-rose-400 text-white'
          }`}
        >
          {isSuccess ? <PartyPopper className="w-8 h-8" /> : <Clock className="w-8 h-8" />}
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-black text-slate-800">
            {isSuccess ? 'تخمين عبقري في محله! 🎉' : 'انتهى وقت الجولة! ⏳'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            الجولة {roundNumber} من {totalRounds}
          </p>
        </div>

        {/* Revealed Secret Word Card */}
        <div className="bg-amber-50 rounded-2xl p-3.5 border border-amber-200 space-y-1">
          <span className="text-[11px] font-bold text-amber-800 block">الكلمة السرية كانت:</span>
          <span className="text-xl font-black text-amber-950 block tracking-wide">
            {secretWord || '...'}
          </span>
          <span className="text-xs text-amber-700 bg-amber-200/60 px-2.5 py-0.5 rounded-full inline-block font-medium">
            فئة: {category}
          </span>
        </div>

        {/* Roles info */}
        <div className="flex items-center justify-around bg-slate-50 p-2.5 rounded-2xl text-xs text-slate-600">
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">الرسام:</span>
            <span className="font-bold text-slate-800">{drawerName}</span>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <span className="text-[10px] text-slate-400 block font-medium">المخمّن:</span>
            <span className="font-bold text-slate-800">{guesserName}</span>
          </div>
        </div>

        {/* Score & Next Round Countdown */}
        <div className="space-y-2 pt-1">
          <div className="text-xs font-bold text-slate-600">
            مجموع نقاط الفريق: <span className="text-indigo-600 font-black text-sm">{score}</span>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>الانتقال التلقائي خلال {countdown} ثوانٍ...</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onNextRound}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>جولة جديدة 🔄</span>
            </button>

            {onSwapDrawer && (
              <button
                type="button"
                onClick={onSwapDrawer}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تبديل الرسام 🔁</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
