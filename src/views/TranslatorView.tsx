import React, { useState, useRef } from 'react';
import {
  Languages,
  ArrowLeftRight,
  Mic,
  Volume2,
  Upload,
  Copy,
  Check,
  Loader2,
  Download,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { TranslationHistoryItem } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { extractDocxText } from '../utils/officeExport';
import { playUiSound } from '../utils/soundFx';

const LANGUAGES = [
  'Auto-Detect',
  'Arabic',
  'English',
  'French',
  'Spanish',
  'German',
  'Turkish',
  'Italian',
  'Portuguese',
  'Russian',
  'Chinese (Simplified)',
  'Japanese',
  'Korean',
  'Hindi',
];

export function TranslatorView() {
  const { t, settings, translationsHistory, setTranslationsHistory, logActivity } = useVip();
  const isAr = settings.language === 'ar';

  const [sourceLang, setSourceLang] = useState('Auto-Detect');
  const [targetLang, setTargetLang] = useState(isAr ? 'English' : 'Arabic');
  const [tone, setTone] = useState('Natural & Accurate');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleTranslate = async (overrideText?: string, pdfBase64?: string) => {
    const input = overrideText ?? sourceText;
    if ((!input.trim() && !pdfBase64) || loading) return;
    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceLang, targetLang, tone, text: input, pdfBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Translation failed');
        setErrorCode(data.code || null);
        return;
      }

      const out = data.translatedText || '';
      setTranslatedText(out);
      const record: TranslationHistoryItem = {
        id: `tr_${Date.now()}`,
        sourceLang,
        targetLang,
        tone,
        sourceText: input.slice(0, 400),
        translatedText: out,
        createdAt: new Date().toISOString(),
      };
      setTranslationsHistory((prev) => [record, ...prev]);
      logActivity('Translated Content', `${sourceLang} → ${targetLang}`);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith('.docx')) {
        const text = await extractDocxText(await file.arrayBuffer());
        setSourceText(text);
        await handleTranslate(text);
      } else if (lower.endsWith('.pdf')) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        setSourceText(`[PDF: ${file.name}]`);
        await handleTranslate('', base64);
      } else {
        const text = await file.text();
        setSourceText(text);
        await handleTranslate(text);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not read uploaded file');
    }
    e.target.value = '';
  };

  const handleVoiceDictation = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => { lang: string; onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void };
      webkitSpeechRecognition?: new () => { lang: string; onresult: (ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void };
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg(isAr ? 'ميزة الإملاء الصوتي غير مدعومة في هذا المتصفح.' : 'Speech recognition unavailable in this browser.');
      return;
    }
    const rec = new SR();
    rec.lang = sourceLang === 'Arabic' || (sourceLang === 'Auto-Detect' && isAr) ? 'ar-SA' : 'en-US';
    setListening(true);
    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || '';
      setSourceText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
  };

  const handleSpeakOutput = async () => {
    if (!translatedText.trim() || speaking) return;
    setSpeaking(true);
    try {
      const res = await fetch('/api/ai/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: translatedText.slice(0, 800),
          voiceName: 'Kore',
          style: 'Clear bilingual narrator',
        }),
      });
      const data = await res.json();
      if (res.ok && data.audioDataUrl) {
        const audio = new Audio(data.audioDataUrl);
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => setSpeaking(false);
        await audio.play();
        return;
      }
    } catch {
      // Fallback to Web Speech API
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(translatedText);
      u.lang = targetLang === 'Arabic' ? 'ar-SA' : 'en-US';
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } else {
      setSpeaking(false);
    }
  };

  const isTargetRtl = targetLang === 'Arabic';
  const isSourceRtl = sourceLang === 'Arabic' || (sourceLang === 'Auto-Detect' && /[\u0600-\u06FF]/.test(sourceText));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.translator}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'ترجمة فورية للنصوص والمستندات (.docx / .pdf) والكلام بدعم كامل للعربية RTL'
              : 'Multilingual text, document (.docx/.pdf) & voice translation with native Arabic RTL & global languages'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <Upload className="w-4 h-4 text-blue-500" />
          <span>{isAr ? 'ترجمة مستند (.docx / .pdf / .txt)' : 'Translate File (.docx / .pdf / .txt)'}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.docx,.pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Language Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <select
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          className="md:col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <div className="md:col-span-1 flex justify-center">
          <button
            type="button"
            onClick={() => {
              if (sourceLang === 'Auto-Detect') return;
              setSourceLang(targetLang);
              setTargetLang(sourceLang);
              setSourceText(translatedText);
              setTranslatedText(sourceText);
            }}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Swap"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>
        </div>

        <select
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          className="md:col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium"
        >
          {LANGUAGES.filter((l) => l !== 'Auto-Detect').map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="md:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium"
        >
          <option value="Natural & Accurate">{isAr ? 'طبيعي ودقيق' : 'Natural & Accurate'}</option>
          <option value="Formal & Executive">{isAr ? 'رسمي واحترافي' : 'Formal & Executive'}</option>
          <option value="Technical & Engineering">{isAr ? 'تقني وهندسي' : 'Technical & Engineering'}</option>
          <option value="Conversational & Casual">{isAr ? 'يومي وودي' : 'Conversational & Casual'}</option>
        </select>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Dual Pane Translator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500">{sourceLang}</span>
            <button
              type="button"
              onClick={handleVoiceDictation}
              className={`px-2.5 py-1 rounded-lg border text-xs inline-flex items-center gap-1 ${
                listening ? 'border-rose-500 text-rose-500 animate-pulse' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{listening ? t.assistant.listening : isAr ? 'إملاء صوتي' : 'Dictate'}</span>
            </button>
          </div>
          <textarea
            rows={10}
            dir={isSourceRtl ? 'rtl' : 'ltr'}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder={isAr ? 'أدخل النص المراد ترجمته...' : 'Enter text to translate...'}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => handleTranslate()}
            disabled={loading || !sourceText.trim()}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
            <span>{isAr ? 'ترجمة الآن' : 'Translate Now'}</span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-blue-600 dark:text-blue-400">{targetLang}</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSpeakOutput}
                disabled={!translatedText.trim() || speaking}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 inline-flex items-center gap-1"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{speaking ? '...' : isAr ? 'نطق' : 'Speak'}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(translatedText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }}
                disabled={!translatedText.trim()}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 inline-flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t.common.copied : t.common.copy}</span>
              </button>
              <button
                type="button"
                disabled={!translatedText.trim()}
                onClick={() => {
                  const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `translation_${targetLang}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <textarea
            rows={10}
            readOnly
            dir={isTargetRtl ? 'rtl' : 'ltr'}
            value={translatedText}
            placeholder={isAr ? 'ستظهر الترجمة هنا...' : 'Translation appears here...'}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/70 p-3.5 text-sm leading-relaxed focus:outline-none"
          />
        </div>
      </div>

      {/* Translation History */}
      {translationsHistory.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
          <h4 className="font-display font-semibold text-sm">{isAr ? 'سجل الترجمات' : 'Recent Translations'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {translationsHistory.slice(0, 6).map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSourceText(item.sourceText);
                  setTranslatedText(item.translatedText);
                  setTargetLang(item.targetLang);
                }}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-blue-600 dark:text-blue-400">
                    {item.sourceLang} → {item.targetLang}
                  </p>
                  <p className="truncate text-slate-500 mt-0.5">{item.sourceText}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTranslationsHistory((prev) => prev.filter((x) => x.id !== item.id));
                  }}
                  className="p-1 text-slate-400 hover:text-rose-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
