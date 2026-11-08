import React from 'react';
import { Mic, MicOff, PhoneCall, AlertCircle } from 'lucide-react';
import { WebRTCCallStatus } from '../types/game';

interface VoiceControlsProps {
  callStatus: WebRTCCallStatus;
  isMuted: boolean;
  micVolume: number;
  voiceError: string | null;
  onJoinVoice: () => void;
  onToggleMute: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  callStatus,
  isMuted,
  micVolume,
  voiceError,
  onJoinVoice,
  onToggleMute,
}) => {
  const isConnected = callStatus === 'connected' || callStatus === 'muted';
  const isConnecting = callStatus === 'connecting' || callStatus === 'requesting_permissions';

  return (
    <div className="bg-white rounded-3xl p-4 border border-amber-200 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              isConnected
                ? isMuted
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700 shadow-sm'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">مكالمة صوتية مباشرة (WebRTC)</h4>
            <p className="text-xs text-slate-500">
              تحدث مع زميلك أثناء الرسم والتخمين
            </p>
          </div>
        </div>

        {/* Action Button */}
        {isConnected ? (
          <button
            onClick={onToggleMute}
            className={`px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
              isMuted
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            aria-label={isMuted ? 'إلغاء كتم الميكروفون' : 'كتم الميكروفون'}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}</span>
          </button>
        ) : (
          <button
            onClick={onJoinVoice}
            disabled={isConnecting}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
            aria-label="تشغيل الميكروفون والانضمام للصوت"
          >
            {isConnecting ? (
              <>
                <PhoneCall className="w-4 h-4 animate-spin" />
                <span>جاري الاتصال...</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>تشغيل الميكروفون</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Visual Volume Meter when connected and unmuted */}
      {isConnected && !isMuted && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400 font-medium">مستوى الصوت:</span>
          <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-75"
              style={{ width: `${Math.max(5, micVolume)}%` }}
            />
          </div>
        </div>
      )}

      {/* Error / Permission Denied Helper */}
      {voiceError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">ملاحظة حول الصوت:</span>
            <span>{voiceError}</span>
            <span className="block text-[11px] text-rose-500">
              يمكنك متابعة اللعب بدون صوت في أي وقت بالاعتماد على التخمين والكتابة!
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
