import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Copy,
  Check,
  Share2,
  QrCode,
  Users,
  Play,
  CheckCircle,
  Clock,
  Sparkles,
  Wifi,
  WifiOff,
  Mic,
  MicOff,
  Settings,
  X,
} from 'lucide-react';
import { RoomSettings, PlayerProfile, PresenceState, WebRTCCallStatus } from '../types/game';
import { VoiceControls } from './VoiceControls';
import { isFirebaseConfigured } from '../services/firebase';
import { addSimulatedPlayer } from '../services/localRoomService';

interface WaitingRoomProps {
  roomCode: string;
  isHost: boolean;
  myUid: string;
  players: Record<string, PlayerProfile>;
  presenceMap: Record<string, PresenceState>;
  settings: RoomSettings;
  onUpdateSettings: (settings: Partial<RoomSettings>) => Promise<void>;
  onToggleReady: (ready: boolean) => Promise<void>;
  onStartGame: () => Promise<void>;
  callStatus: WebRTCCallStatus;
  isMuted: boolean;
  micVolume: number;
  voiceError: string | null;
  onJoinVoice: () => void;
  onToggleMute: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({
  roomCode,
  isHost,
  myUid,
  players,
  presenceMap,
  settings,
  onUpdateSettings,
  onToggleReady,
  onStartGame,
  callStatus,
  isMuted,
  micVolume,
  voiceError,
  onJoinVoice,
  onToggleMute,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  useEffect(() => {
    QRCode.toDataURL(inviteUrl, { width: 260, margin: 2 })
      .then(setQrDataUrl)
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [inviteUrl]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'العب معي: ارسمها لو تقدر!',
          text: `انضم إلى غرفتي في لعبة "ارسمها لو تقدر": رمز الغرفة ${roomCode}`,
          url: inviteUrl,
        });
        return;
      } catch {}
    }

    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const playerList = Object.values(players);
  const myPlayer = players[myUid];
  const isReady = myPlayer?.ready ?? false;
  const otherPlayer = playerList.find((p) => p.uid !== myUid);

  const canStartGame = isHost && playerList.length >= 2;

  return (
    <div className="max-w-md w-full mx-auto space-y-4 pb-8">
      {/* Room Code Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-amber-200 text-center space-y-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
          كود الغرفة الخاص بك
        </span>

        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-black font-mono tracking-widest text-amber-600 bg-amber-50 px-6 py-2 rounded-2xl border border-amber-200">
            {roomCode}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'تم النسخ!' : 'نسخ الكود'}</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'تم نسخ الرابط!' : 'مشاركة الرابط'}</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
            title="عرض كود QR للمسح من كاميرا الهاتف"
            aria-label="عرض رمز QR"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Players Status Card */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-amber-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Users className="w-4 h-4 text-amber-600" />
            <span>اللاعبون ({playerList.length}/2)</span>
          </div>
          {playerList.length < 2 && (
            <span className="text-[11px] text-amber-600 font-bold animate-pulse">
              في انتظار انضمام اللاعب الثاني...
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Player 1 (Me) */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 relative">
            <div className="flex items-center gap-2">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-xs"
                style={{ backgroundColor: myPlayer?.avatarColor || '#f97316' }}
              >
                {myPlayer?.name ? myPlayer.name.charAt(0) : 'أ'}
              </div>
              <div className="overflow-hidden">
                <span className="font-bold text-xs text-slate-800 truncate block">
                  {myPlayer?.name} (أنت)
                </span>
                <span className="text-[10px] text-indigo-600 font-bold block">
                  {myPlayer?.isHost ? 'المضيف (Host)' : 'لاعب'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-600 font-bold">
                <Wifi className="w-3 h-3" /> متصل
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-bold ${
                  isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {isReady ? 'جاهز ✓' : 'في الانتظار'}
              </span>
            </div>
          </div>

          {/* Player 2 */}
          {otherPlayer ? (
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 relative">
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base shadow-xs"
                  style={{ backgroundColor: otherPlayer.avatarColor || '#06b6d4' }}
                >
                  {otherPlayer.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <span className="font-bold text-xs text-slate-800 truncate block">
                    {otherPlayer.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    {otherPlayer.isHost ? 'المضيف' : 'لاعب'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[11px]">
                {presenceMap[otherPlayer.uid]?.online !== false ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-bold">
                    <Wifi className="w-3 h-3" /> متصل
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 font-bold animate-pulse">
                    <WifiOff className="w-3 h-3" /> انقطع الاتصال
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    otherPlayer.ready ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {otherPlayer.ready ? 'جاهز ✓' : 'في الانتظار'}
                </span>
              </div>
            </div>
          ) : (
            <div className="border-2 border-dashed border-amber-300 rounded-2xl p-3.5 flex flex-col items-center justify-center text-center space-y-1.5">
              <Users className="w-6 h-6 text-amber-400" />
              <span className="text-xs font-bold text-slate-600">اللاعب الثاني</span>
              <span className="text-[10px] text-slate-400">شارك الكود أو الرابط للدخول</span>
              <button
                type="button"
                onClick={() => addSimulatedPlayer(roomCode)}
                className="mt-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-bold shadow-xs transition-colors flex items-center gap-1 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>إضافة لاعب تجريبي (فهد 🤖)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Voice Call Controls */}
      <VoiceControls
        callStatus={callStatus}
        isMuted={isMuted}
        micVolume={micVolume}
        voiceError={voiceError}
        onJoinVoice={onJoinVoice}
        onToggleMute={onToggleMute}
      />

      {/* Game Settings Card (Host editable, Guest view) */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-amber-200 space-y-3 text-right">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Settings className="w-4 h-4 text-amber-600" />
          <span>إعدادات اللعبة {isHost ? '(يحددها المضيف)' : '(عرض)'}</span>
        </div>

        {/* Rounds Count */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 block">عدد الجولات:</label>
          <div className="grid grid-cols-3 gap-2">
            {[4, 8, 12].map((cnt) => (
              <button
                key={cnt}
                disabled={!isHost}
                onClick={() => onUpdateSettings({ roundsCount: cnt as any })}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  settings.roundsCount === cnt
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:hover:bg-slate-100'
                }`}
              >
                {cnt} جولات
              </button>
            ))}
          </div>
        </div>

        {/* Round Duration */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 block">مدة كل جولة:</label>
          <div className="grid grid-cols-3 gap-2">
            {[45, 60, 90].map((dur) => (
              <button
                key={dur}
                disabled={!isHost}
                onClick={() => onUpdateSettings({ roundDurationSec: dur as any })}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  settings.roundDurationSec === dur
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:hover:bg-slate-100'
                }`}
              >
                {dur} ثانية
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-500 block">مستوى الكلمات:</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { val: 'easy', label: 'سهل' },
              { val: 'medium', label: 'متوسط' },
              { val: 'mixed', label: 'مختلط' },
            ].map((diff) => (
              <button
                key={diff.val}
                disabled={!isHost}
                onClick={() => onUpdateSettings({ difficulty: diff.val as any })}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  settings.difficulty === diff.val
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:hover:bg-slate-100'
                }`}
              >
                {diff.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ready and Start Action Bar */}
      <div className="space-y-2 pt-2">
        {/* Toggle Ready button for non-hosts or hosts */}
        <button
          onClick={() => onToggleReady(!isReady)}
          className={`w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
            isReady
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-slate-800 hover:bg-slate-900 text-white'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          <span>{isReady ? 'أنت مستعد الآن ✓ (اضغط للإلغاء)' : 'أنا مستعد للعب!'}</span>
        </button>

        {/* Host Start Game Button */}
        {isHost && (
          <button
            onClick={onStartGame}
            disabled={!canStartGame}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-40 text-white rounded-2xl font-black text-base flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 transition-all active:scale-98"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>ابدأ اللعبة الآن</span>
          </button>
        )}

        {isHost && playerList.length < 2 && (
          <p className="text-center text-xs text-amber-700/80 font-medium">
            يجب انضمام لاعب ثانٍ للتمكن من بدء اللعبة.
          </p>
        )}
      </div>

      {/* QR Code Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-800">امسح الكود بالهاتف الثاني</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Room QR Code"
                className="w-48 h-48 mx-auto rounded-2xl border border-slate-200"
              />
            ) : (
              <div className="w-48 h-48 mx-auto bg-slate-100 rounded-2xl animate-pulse" />
            )}

            <div className="text-xs text-slate-500">
              وجّه كاميرا هاتفك الثاني لمسح الكود وفتح الغرفة تلقائيًا!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
