import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ThumbsUp,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import { GuessMessage } from '../types/game';

interface GuessPanelProps {
  isDrawer: boolean;
  wordMask?: string;
  category?: string;
  revealedChar?: string;
  isHintRevealed?: boolean;
  secondsUntilHint?: number;
  wordCount?: number;
  letterCount?: number;
  guesses: GuessMessage[];
  onSubmitGuess: (text: string) => void;
  onAcceptManualCorrect?: (guess: GuessMessage) => void;
  onDrawerMarkCorrect?: () => void;
  onDrawerMarkIncorrect?: () => void;
  disabled?: boolean;
}

export const GuessPanel: React.FC<GuessPanelProps> = ({
  isDrawer,
  wordMask,
  category,
  revealedChar,
  isHintRevealed = false,
  secondsUntilHint = 0,
  wordCount,
  letterCount,
  guesses,
  onSubmitGuess,
  onAcceptManualCorrect,
  onDrawerMarkCorrect,
  onDrawerMarkIncorrect,
  disabled = false,
}) => {
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of guesses
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [guesses]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = inputText.trim().slice(0, 80);
    if (!clean || disabled) return;

    onSubmitGuess(clean);
    setInputText('');
  };

  const wordCountLabel =
    wordCount === 1 ? 'كلمة واحدة' : wordCount === 2 ? 'كلمتان' : wordCount ? `${wordCount} كلمات` : '';

  return (
    <div className="w-full max-w-lg mx-auto bg-white rounded-3xl shadow-sm border border-amber-200 overflow-hidden flex flex-col mt-2">
      {/* ----------------- Guesser Secret Word Hint Banner ----------------- */}
      {!isDrawer && wordMask && (
        <div
          className={`border-b px-4 py-2.5 transition-all ${
            isHintRevealed
              ? 'bg-gradient-to-r from-amber-100 via-orange-100 to-amber-100 border-amber-300'
              : 'bg-amber-100/70 border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isHintRevealed ? (
                <Sparkles className="w-4 h-4 text-amber-600 animate-spin" />
              ) : (
                <Lightbulb className="w-4 h-4 text-amber-500" />
              )}
              <span className="text-[11px] font-bold text-amber-900">
                {isHintRevealed ? '💡 تلميح منتصف الوقت مُفعّل:' : 'تلميح الكلمة:'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {wordCountLabel && (
                <span className="text-[10px] bg-white/80 text-amber-900 font-bold px-2 py-0.5 rounded-full border border-amber-200/60">
                  {wordCountLabel}
                </span>
              )}
              {letterCount && (
                <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                  {letterCount} أحرف
                </span>
              )}
            </div>
          </div>

          <div className="mt-1 flex items-center justify-between">
            <span className="text-lg font-black tracking-widest text-slate-900 font-mono drop-shadow-2xs">
              {wordMask}
            </span>

            {isHintRevealed && revealedChar ? (
              <span className="text-xs bg-emerald-600 text-white font-black px-2.5 py-1 rounded-xl shadow-xs animate-bounce">
                الحرف المكشوف: «{revealedChar}»
              </span>
            ) : secondsUntilHint > 0 ? (
              <span className="text-[11px] text-amber-700/80 font-medium">
                كشف حرف بعد {secondsUntilHint} ث
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* ----------------- Drawer Controls: "خمن صح" & "خمن غلط" ----------------- */}
      {isDrawer && !disabled && (
        <div className="bg-amber-50/90 border-b border-amber-200 px-3.5 py-2.5 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs font-black text-slate-800">حكم الرسام:</span>
            <span className="text-[10px] text-slate-500">
              {isHintRevealed && revealedChar
                ? `💡 تم كشف الحرف «${revealedChar}» للمخمّن`
                : secondsUntilHint > 0
                ? `💡 كشف حرف للمخمّن بعد ${secondsUntilHint} ث`
                : 'اضغط لتأكيد إجابة الزميل'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDrawerMarkCorrect}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all active:scale-95"
              title="تأكيد أن الزميل خمّن الكلمة صحيحة واحتساب النقاط"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>خمّن صح ✅</span>
            </button>

            <button
              type="button"
              onClick={onDrawerMarkIncorrect}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all active:scale-95"
              title="تنبيه الزميل بأن تخمينه خاطئ ليستمر في المحاولة"
            >
              <XCircle className="w-4 h-4" />
              <span>خمّن غلط ❌</span>
            </button>
          </div>
        </div>
      )}

      {/* ----------------- Guesses Feed ----------------- */}
      <div
        ref={scrollRef}
        className="p-3 max-h-36 min-h-[90px] overflow-y-auto space-y-2 flex flex-col scrollbar-thin bg-slate-50/50"
      >
        {guesses.length === 0 ? (
          <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center gap-1.5">
            <MessageSquare className="w-4 h-4 opacity-40" />
            <span>{isDrawer ? 'في انتظار تخمينات اللاعب الآخر...' : 'اكتب تخمينك هنا وسيراها الرسام فورًا!'}</span>
          </div>
        ) : (
          guesses.map((g) => (
            <div
              key={g.id}
              className={`flex items-center justify-between p-2 rounded-2xl text-xs transition-all ${
                g.isCorrect
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-950 font-bold'
                  : g.uid === 'system'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800 font-bold'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600 text-[11px]">{g.playerName}:</span>
                <span className="text-xs">{g.text}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {g.isCorrect && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-white/80 px-2 py-0.5 rounded-full font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>إجابة صحيحة!</span>
                  </span>
                )}

                {/* Drawer manual override button if not yet marked correct */}
                {isDrawer && !g.isCorrect && g.uid !== 'system' && onAcceptManualCorrect && !disabled && (
                  <button
                    type="button"
                    onClick={() => onAcceptManualCorrect(g)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-[11px] font-bold transition-colors"
                    title="قبول هذا التخمين كإجابة صحيحة"
                    aria-label="قبول كإجابة صحيحة"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>صحيحة</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ----------------- Guesser Input Box ----------------- */}
      {!isDrawer && (
        <form onSubmit={handleSend} className="p-2 border-t border-slate-200 bg-white flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value.slice(0, 80))}
            placeholder={disabled ? 'الجولة منتهية' : 'خمّن الكلمة هنا بالعامية المصرية...'}
            disabled={disabled}
            maxLength={80}
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 bg-slate-50 text-sm font-medium text-slate-800 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={disabled || !inputText.trim()}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold rounded-2xl flex items-center justify-center gap-1 transition-all shadow-xs text-sm"
            aria-label="إرسال التخمين"
          >
            <span>إرسال</span>
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      )}
    </div>
  );
};
