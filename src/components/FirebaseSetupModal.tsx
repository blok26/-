import React, { useState } from 'react';
import { Database, Check, ExternalLink, HelpCircle, AlertCircle, X } from 'lucide-react';
import {
  saveFirebaseConfig,
  getStoredFirebaseConfig,
  FirebaseConfigOptions,
} from '../services/firebase';

interface FirebaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isMandatory?: boolean;
}

export const FirebaseSetupModal: React.FC<FirebaseSetupModalProps> = ({
  isOpen,
  onClose,
  isMandatory = false,
}) => {
  const currentConfig = getStoredFirebaseConfig();

  const [apiKey, setApiKey] = useState(currentConfig?.apiKey || '');
  const [databaseURL, setDatabaseURL] = useState(currentConfig?.databaseURL || '');
  const [projectId, setProjectId] = useState(currentConfig?.projectId || '');
  const [authDomain, setAuthDomain] = useState(currentConfig?.authDomain || '');
  const [appId, setAppId] = useState(currentConfig?.appId || '');
  const [rawJson, setRawJson] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJsonPaste = (text: string) => {
    setRawJson(text);
    setParseError(null);
    try {
      // Clean JSON or JS object
      const cleaned = text
        .replace(/const firebaseConfig = /, '')
        .replace(/;/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.apiKey) setApiKey(parsed.apiKey);
      if (parsed.databaseURL) setDatabaseURL(parsed.databaseURL);
      if (parsed.projectId) setProjectId(parsed.projectId);
      if (parsed.authDomain) setAuthDomain(parsed.authDomain);
      if (parsed.appId) setAppId(parsed.appId);
    } catch {
      // Ignore partial json typing
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || !databaseURL.trim() || !projectId.trim()) {
      setParseError('يرجى ملء مفتاح API وعنوان قاعدة البيانات (Database URL) ومعرف المشروع على الأقل.');
      return;
    }

    const config: FirebaseConfigOptions = {
      apiKey: apiKey.trim(),
      databaseURL: databaseURL.trim(),
      projectId: projectId.trim(),
      authDomain: authDomain.trim() || `${projectId.trim()}.firebaseapp.com`,
      appId: appId.trim() || '1:manual:web:app',
    };

    saveFirebaseConfig(config);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-amber-200 space-y-4 my-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">إعداد Firebase Realtime Database</h2>
              <p className="text-xs text-slate-500">
                مطلوب للمزامنة اللحظية الحقيقية بين الهاتفين
              </p>
            </div>
          </div>

          {!isMandatory && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Instructions Banner */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-950 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-900">
            <HelpCircle className="w-4 h-4 text-amber-600" />
            <span>كيف تحصل على هذه البيانات في دقيقة واحدة؟</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-slate-700 pr-1">
            <li>افتح <strong>Firebase Console</strong> وأنشئ مشروعًا مجانيًا.</li>
            <li>فعّل <strong>Anonymous Authentication</strong> من قسم Build &gt; Authentication.</li>
            <li>أنشئ <strong>Realtime Database</strong> بنقرة واحدة وانسخ الرابط الخاص بها.</li>
            <li>أضف تطبيق ويب (Web App) وانسخ كود الإعداد (firebaseConfig) والصقه هنا.</li>
          </ol>
          <a
            href="https://console.firebase.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold mt-1"
          >
            <span>فتح Firebase Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Quick Paste JSON */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 block">
            لصق سريع لكائن firebaseConfig (اختياري):
          </label>
          <textarea
            value={rawJson}
            onChange={(e) => handleJsonPaste(e.target.value)}
            placeholder='{ "apiKey": "...", "databaseURL": "https://...", "projectId": "..." }'
            className="w-full h-16 p-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          />
        </div>

        {/* Form fields */}
        <form onSubmit={handleSave} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 block">
              Database URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              dir="ltr"
              value={databaseURL}
              onChange={(e) => setDatabaseURL(e.target.value)}
              placeholder="https://your-app-default-rtdb.firebaseio.com"
              className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-left"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                API Key <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-left"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                Project ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                dir="ltr"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="my-cool-game"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden text-left"
              />
            </div>
          </div>

          {parseError && (
            <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded-xl flex items-center gap-1.5 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
            >
              <Check className="w-4 h-4" />
              <span>حفظ الإعدادات وبدء اللعب الآن</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
