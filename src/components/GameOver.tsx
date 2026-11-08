import React, { useState } from 'react';
import { Trophy, RotateCcw, Home, Share2, Check, Award, Star, Flame } from 'lucide-react';
import { GameResults } from '../types/game';

interface GameOverProps {
  results: GameResults | null;
  totalScore: number;
  correctRounds: number;
  totalRounds: number;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
  isHost: boolean;
}

export const GameOver: React.FC<GameOverProps> = ({
  results,
  totalScore,
  correctRounds,
  totalRounds,
  onPlayAgain,
  onReturnToLobby,
  isHost,
}) => {
  const [copiedShare, setCopiedShare] = useState(false);

  const displayBadge = results?.titleBadge || (
    correctRounds >= totalRounds * 0.75
      ? 'رسامان عبقريان 🎨✨'
      : correctRounds >= totalRounds * 0.4
      ? 'على نفس الموجة 🌊'
      : 'نحتاج دورة رسم صغيرة 😄'
  );

  const handleShare = async () => {
    const shareText = `لعبنا "ارسمها لو تقدر" وحققنا ${totalScore} نقطة وخمنّا ${correctRounds} من ${totalRounds} جولات بنجاح! لقبنا: ${displayBadge} 🎨✨`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ارسمها لو تقدر',
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch {}
    }

    navigator.clipboard.writeText(shareText);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  return (
    <div className="min-h-screen bg-amber-50/80 p-4 flex items-center justify-center">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-amber-200 text-center space-y-6">
        {/* Trophy Header */}
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-400 to-yellow-300 text-white rounded-3xl mx-auto flex items-center justify-center shadow-lg">
            <Trophy className="w-10 h-10 drop-shadow-sm text-amber-950" />
          </div>
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-black px-3 py-0.5 rounded-full shadow-xs">
            نهاية المغامرة
          </div>
        </div>

        {/* Fun Badge Title */}
        <div className="pt-2">
          <h2 className="text-2xl font-black text-slate-800">{displayBadge}</h2>
          <p className="text-xs text-slate-500 mt-1">
            عمل رائع كفريق متعاون ومتناغم!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
              <Flame className="w-4 h-4 text-amber-600" />
              <span>مجموع النقاط</span>
            </div>
            <span className="text-2xl font-black text-amber-950">{totalScore}</span>
          </div>

          <div className="bg-indigo-50 p-3.5 rounded-2xl border border-indigo-200">
            <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-bold mb-1">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>إجابات صحيحة</span>
            </div>
            <span className="text-2xl font-black text-indigo-950">
              {correctRounds} <span className="text-sm font-normal text-slate-400">/ {totalRounds}</span>
            </span>
          </div>

          <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
              <Star className="w-4 h-4 text-emerald-600" />
              <span>نسبة النجاح</span>
            </div>
            <span className="text-xl font-black text-emerald-950">
              {Math.round((correctRounds / Math.max(1, totalRounds)) * 100)}%
            </span>
          </div>

          <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200">
            <div className="flex items-center gap-1.5 text-purple-700 text-xs font-bold mb-1">
              <Trophy className="w-4 h-4 text-purple-600" />
              <span>أسلوب اللعب</span>
            </div>
            <span className="text-sm font-black text-purple-950 block mt-1">
              تعاوني 100%
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          {isHost ? (
            <button
              onClick={onPlayAgain}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-98"
            >
              <RotateCcw className="w-4 h-4" />
              <span>العبوا مرة أخرى</span>
            </button>
          ) : (
            <p className="text-xs text-slate-500 italic">
              في انتظار المضيف لبدء جولة جديدة...
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onReturnToLobby}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span>غرفة الانتظار</span>
            </button>

            <button
              onClick={handleShare}
              className="flex-1 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedShare ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>تم النسخ!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة النتيجة</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
