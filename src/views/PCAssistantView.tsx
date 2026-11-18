import React, { useState, useRef } from 'react';
import {
  MonitorCog,
  FolderOpen,
  ShieldAlert,
  Terminal,
  CheckCircle2,
  Loader2,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { PcSessionNote } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

interface ApprovedFolderFile {
  name: string;
  size: number;
  type: string;
  path: string;
}

export function PCAssistantView() {
  const { t, settings, pcSessions, setPcSessions, logActivity } = useVip();
  const isAr = settings.language === 'ar';

  const [osTarget, setOsTarget] = useState<'Windows' | 'macOS' | 'Linux' | 'Android'>('Windows');
  const [query, setQuery] = useState('');
  const [approvedFiles, setApprovedFiles] = useState<ApprovedFolderFile[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<PcSessionNote | null>(pcSessions[0] || null);
  const [pendingConfirmStep, setPendingConfirmStep] = useState<{ title: string; cmd: string } | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const dirInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectFolder = async () => {
    setErrorMsg(null);
    const pickerWin = window as unknown as {
      showDirectoryPicker?: () => Promise<{
        name: string;
        values: () => AsyncIterableIterator<{ kind: string; name: string; getFile?: () => Promise<File> }>;
      }>;
    };

    if (pickerWin.showDirectoryPicker) {
      try {
        const handle = await pickerWin.showDirectoryPicker();
        const collected: ApprovedFolderFile[] = [];
        for await (const entry of handle.values()) {
          if (entry.kind === 'file' && entry.getFile) {
            const f = await entry.getFile();
            collected.push({ name: f.name, size: f.size, type: f.type || 'unknown', path: `${handle.name}/${f.name}` });
          } else if (entry.kind === 'directory') {
            collected.push({ name: `${entry.name}/`, size: 0, type: 'folder', path: `${handle.name}/${entry.name}/` });
          }
          if (collected.length >= 80) break;
        }
        setFolderName(handle.name);
        setApprovedFiles(collected);
        logActivity('Inspected Approved Folder', `${handle.name} (${collected.length} items)`);
        return;
      } catch {
        // User cancelled or blocked by iframe sandbox; fall through to standard directory input if clicked
      }
    }
    dirInputRef.current?.click();
  };

  const handleDirInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;
    const mapped: ApprovedFolderFile[] = fileList.slice(0, 80).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type || 'file',
      path: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name,
    }));
    const rootFolder = mapped[0]?.path.split('/')[0] || 'Selected Folder';
    setFolderName(rootFolder);
    setApprovedFiles(mapped);
    logActivity('Loaded Folder Listing', `${rootFolder} (${mapped.length} items)`);
    e.target.value = '';
  };

  const handleAskAssistant = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    const manifestText = approvedFiles
      .map((f) => `- ${f.path} (${f.type === 'folder' ? 'directory' : `${Math.round(f.size / 1024)} KB`})`)
      .join('\n');

    try {
      const res = await fetch('/api/ai/pc/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          osTarget,
          folderManifest: manifestText,
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to generate workflow guidance.');
        setErrorCode(data.code || null);
        return;
      }

      const note: PcSessionNote = {
        id: `pc_${Date.now()}`,
        title: data.guide?.title || query.slice(0, 40),
        osTarget,
        query: query.trim(),
        summary: data.guide?.summary || '',
        safetyWarning: data.guide?.safetyWarning || '',
        steps: Array.isArray(data.guide?.steps) ? data.guide.steps : [],
        createdAt: new Date().toISOString(),
      };
      setActiveNote(note);
      setPcSessions((prev) => [note, ...prev]);
      logActivity('Generated PC Workflow Guide', `${note.title} (${osTarget})`);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const copyCommand = async (cmd: string, requiresConfirm?: boolean, title?: string) => {
    if (requiresConfirm && (!pendingConfirmStep || pendingConfirmStep.cmd !== cmd)) {
      setPendingConfirmStep({ title: title || 'System Command', cmd });
      return;
    }
    await navigator.clipboard.writeText(cmd);
    setCopiedCmd(cmd);
    setPendingConfirmStep(null);
    setTimeout(() => setCopiedCmd(null), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.pcAssistant}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'إرشادات خطوة بخطوة لتنظيم ملفاتك وأوامر النظام مع طلب تأكيد صريح قبل أي إجراء حساس'
              : 'Step-by-step computer workflow guidance, read-only approved folder inspection & confirmation-gated file commands'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSelectFolder}
          className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
        >
          <FolderOpen className="w-4 h-4 text-blue-500" />
          <span>{isAr ? 'فحص مجلد محلي (بإذنك)' : 'Inspect Local Folder (With Permission)'}</span>
        </button>
        <input
          ref={dirInputRef}
          type="file"
          {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
          multiple
          onChange={handleDirInput}
          className="hidden"
        />
      </div>

      {/* Honest Browser Sandbox Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p>
          {isAr
            ? 'أمان المتصفح: يقوم VIP AI بتحليل قائمة الملفات التي تختارها وإعداد أوامر تنظيم آمنة لك، ولن يقوم أبداً بتعديل أو حذف أي ملف على جهازك تلقائياً بدون مراجعتك وتأكيدك اليدوي.'
            : 'Safety & Transparency: VIP AI inspects only folders you explicitly grant permission to read and prepares step-by-step OS guides/commands. No files on your computer are ever modified or deleted automatically.'}
        </p>
      </div>

      {/* Query & OS Selector */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">{isAr ? 'النظام المستهدف:' : 'Target OS:'}</span>
          {(['Windows', 'macOS', 'Linux', 'Android'] as const).map((os) => (
            <button
              key={os}
              type="button"
              onClick={() => setOsTarget(os)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                osTarget === os
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {os}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <textarea
            rows={2}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isAr
                ? 'مثال: ساعدني في تنظيم مجلد التنزيلات حسب نوع الملفات وإيجاد الملفات المكررة بأمان...'
                : 'Example: Help me organize this selected Downloads folder by file extension and clean temp build caches safely...'
            }
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleAskAssistant}
            disabled={loading || !query.trim()}
            className="sm:self-end px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MonitorCog className="w-4 h-4" />}
            <span>{isAr ? 'توليد خطة العمل' : 'Generate PC Workflow'}</span>
          </button>
        </div>

        {folderName && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {isAr ? `المجلد المصرح به: ${folderName}` : `Approved Folder: ${folderName}`} ({approvedFiles.length}{' '}
                {isAr ? 'عنصر' : 'items'})
              </span>
              <button
                type="button"
                onClick={() => {
                  setFolderName(null);
                  setApprovedFiles([]);
                }}
                className="text-slate-400 hover:text-rose-500 text-xs"
              >
                {t.common.clear}
              </button>
            </div>
            <div className="max-h-28 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 text-[11px] font-mono text-slate-500">
              {approvedFiles.slice(0, 24).map((f, idx) => (
                <div key={idx} className="truncate px-2 py-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  {f.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Confirmation Gate Modal for File-Modifying Commands */}
      {pendingConfirmStep && (
        <div className="rounded-xl border-2 border-rose-500/60 bg-rose-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-500 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isAr
                ? `تأكيد مطلوب: "${pendingConfirmStep.title}" يعدّل الملفات عند تشغيله في الطرفية`
                : `User Confirmation Required: "${pendingConfirmStep.title}" modifies files when executed`}
            </span>
          </div>
          <pre dir="ltr" className="text-xs font-mono bg-slate-950 text-amber-300 p-3 rounded-lg overflow-x-auto">
            {pendingConfirmStep.cmd}
          </pre>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => copyCommand(pendingConfirmStep.cmd, false)}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              {isAr ? 'أؤكد فهمي — نسخ الأمر' : 'I Confirm — Copy Command'}
            </button>
            <button
              type="button"
              onClick={() => setPendingConfirmStep(null)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs"
            >
              {t.common.cancel}
            </button>
          </div>
        </div>
      )}

      {/* Results + History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-4">
          {activeNote ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-base">{activeNote.title}</h3>
                  <span className="px-2 py-0.5 rounded bg-blue-600/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold">
                    {activeNote.osTarget}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{activeNote.summary}</p>
              </div>

              {activeNote.safetyWarning && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
                  {activeNote.safetyWarning}
                </div>
              )}

              <div className="space-y-3">
                {activeNote.steps.map((st) => (
                  <div
                    key={st.stepNumber}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-semibold text-sm">
                          {st.stepNumber}. {st.title}
                        </span>
                      </div>
                      {st.requiresConfirmation && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[10px] font-semibold">
                          {isAr ? 'يتطلب تأكيداً' : 'Needs Confirmation'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{st.detail}</p>
                    {st.commandHint && (
                      <div className="flex items-center justify-between gap-2 bg-slate-950 text-emerald-300 font-mono text-xs p-2.5 rounded-lg" dir="ltr">
                        <span className="flex items-center gap-2 overflow-x-auto">
                          <Terminal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <code>{st.commandHint}</code>
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCommand(st.commandHint!, st.requiresConfirmation, st.title)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 shrink-0"
                          title={t.common.copy}
                        >
                          {copiedCmd === st.commandHint ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
              {isAr ? 'اسأل عن أي مهمة على نظام التشغيل أو افحص مجلداً للبدء.' : 'Ask any OS workflow question or inspect a folder to begin.'}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm">{isAr ? 'الإرشادات المحفوظة' : 'Saved Guides'}</h4>
          {pcSessions.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {pcSessions.map((ps) => (
                <div
                  key={ps.id}
                  onClick={() => setActiveNote(ps)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 ${
                    activeNote?.id === ps.id
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{ps.title}</p>
                    <p className="text-[11px] text-slate-500">{ps.osTarget}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPcSessions((prev) => prev.filter((x) => x.id !== ps.id));
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
