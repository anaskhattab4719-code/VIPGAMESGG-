import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Code2,
  Play,
  Copy,
  Check,
  Download,
  Save,
  Loader2,
  FolderTree,
  Eye,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { CodeProject } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const LANGUAGES = ['HTML', 'CSS', 'JavaScript', 'Python', 'C++', 'Java', 'Kotlin', 'C#'];

export function ProgrammingView() {
  const { t, settings, codeProjects, setCodeProjects } = useVip();

  const [targetLanguage, setTargetLanguage] = useState('JavaScript');
  const [action, setAction] = useState<'generate' | 'explain' | 'debug' | 'improve' | 'structure'>('generate');
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState(`// VIP AI Code Editor\nfunction greetCreator(name) {\n  return \`Welcome to VIP AI, \${name}!\`;\n}\nconsole.log(greetCreator("Architect"));`);
  const [filename, setFilename] = useState('main.js');
  const [explanation, setExplanation] = useState('');
  const [files, setFiles] = useState<Array<{ path: string; content: string }>>([]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [viewTab, setViewTab] = useState<'editor' | 'files' | 'preview'>('editor');

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const runAssistant = async () => {
    if ((!prompt.trim() && !code.trim()) || loading) return;
    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/code/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetLanguage,
          prompt: prompt.trim() || `${action} the provided ${targetLanguage} code`,
          existingCode: code,
          uiLanguage: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Code assist failed');
        setErrorCode(data.code || null);
        return;
      }

      const result = data.result;
      if (result.mainCode) setCode(result.mainCode);
      if (result.mainFilename) setFilename(result.mainFilename);
      if (result.explanationMarkdown) setExplanation(result.explanationMarkdown);
      if (Array.isArray(result.files)) setFiles(result.files);
      if (result.previewHtml) {
        setPreviewHtml(result.previewHtml);
      } else if (['HTML', 'CSS', 'JavaScript'].includes(targetLanguage) && result.mainCode) {
        setPreviewHtml(
          targetLanguage === 'HTML'
            ? result.mainCode
            : targetLanguage === 'CSS'
              ? `<style>${result.mainCode}</style><div class="preview">CSS Preview Ready</div>`
              : `<!doctype html><html><body><pre id="out"></pre><script>const log=(...a)=>{document.getElementById('out').textContent+=a.join(' ')+'\\n'};console.log=log;${result.mainCode}</script></body></html>`
        );
      }

      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    const item: CodeProject = {
      id: `code_${Date.now()}`,
      title: prompt.trim().slice(0, 40) || filename,
      language: targetLanguage,
      mainFilename: filename,
      mainCode: code,
      explanationMarkdown: explanation,
      previewHtml,
      files,
      updatedAt: new Date().toISOString(),
    };
    setCodeProjects((prev) => [item, ...prev]);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1600);
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    zip.file(filename || 'main.txt', code);
    if (explanation) zip.file('README.md', explanation);
    for (const f of files) {
      zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vip_ai_${targetLanguage.toLowerCase().replace('+', 'p')}_project.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildSandboxDoc = () => {
    if (previewHtml) return previewHtml;
    if (targetLanguage === 'HTML') return code;
    if (targetLanguage === 'CSS') return `<style>${code}</style><div style="padding:24px;font-family:sans-serif">Styled Preview Element</div>`;
    if (targetLanguage === 'JavaScript') {
      return `<!doctype html><html><body style="font-family:monospace;padding:16px;background:#0f172a;color:#e2e8f0"><pre id="out"></pre><script>console.log=(...a)=>{document.getElementById('out').textContent+=a.map(x=>typeof x==='object'?JSON.stringify(x,null,2):String(x)).join(' ')+'\\n'};try{${code}}catch(e){console.log('Error:',e.message)}</script></body></html>`;
    }
    return `<!doctype html><html><body style="font-family:sans-serif;padding:24px;background:#0f172a;color:#94a3b8">Live sandbox execution supports HTML, CSS, and JavaScript. Export the .zip archive to compile ${targetLanguage} locally.</body></html>`;
  };

  const lineCount = code.split('\n').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.programming.title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {t.programming.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleSave}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedNotice ? t.common.saved : t.programming.saveProject}</span>
          </button>
          <button
            type="button"
            onClick={handleExportZip}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.programming.exportZip}</span>
          </button>
        </div>
      </div>

      {/* Language + Action Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setTargetLanguage(lang)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
                  targetLanguage === lang
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
            {(['generate', 'explain', 'debug', 'improve', 'structure'] as const).map((act) => (
              <button
                key={act}
                type="button"
                onClick={() => setAction(act)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  action === act
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {t.programming.actions[act]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runAssistant()}
            placeholder={t.programming.promptPlaceholder}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={runAssistant}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            <span>{t.programming.runAction}</span>
          </button>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 space-y-4">
          {/* Sub-Tabs: Editor / Project Files / Live Preview */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#131722] border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setViewTab('editor')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 ${
                  viewTab === 'editor' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{t.programming.editorTab}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab('files')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 ${
                  viewTab === 'files' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>{t.programming.filesTab} ({files.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab('preview')}
                className={`px-3 py-1.5 rounded text-xs font-medium inline-flex items-center gap-1.5 ${
                  viewTab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{t.programming.previewTab}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.common.copied : t.common.copy}</span>
            </button>
          </div>

          {viewTab === 'editor' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden" dir="ltr">
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>{filename}</span>
                <span>{targetLanguage} · {lineCount} lines</span>
              </div>
              <div className="flex max-h-[460px] overflow-auto">
                <div className="py-3 px-3 text-right select-none font-mono text-xs text-slate-600 bg-slate-900/50 border-r border-slate-800 tabular-nums">
                  {Array.from({ length: lineCount }, (_, i) => (
                    <div key={i} className="leading-6">
                      {i + 1}
                    </div>
                  ))}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  spellCheck={false}
                  rows={Math.max(16, lineCount)}
                  className="flex-1 bg-transparent text-slate-100 font-mono text-xs leading-6 p-3 focus:outline-none resize-none"
                />
              </div>
            </div>
          )}

          {viewTab === 'files' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
              {files.length === 0 ? (
                <p className="text-xs text-slate-500">{t.common.empty}</p>
              ) : (
                files.map((f) => (
                  <div
                    key={f.path}
                    className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden"
                    dir="ltr"
                  >
                    <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 text-xs font-mono flex justify-between">
                      <span>{f.path}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFilename(f.path);
                          setCode(f.content);
                          setViewTab('editor');
                        }}
                        className="text-blue-500 hover:underline"
                      >
                        Open in Editor
                      </button>
                    </div>
                    <pre className="p-3 text-xs font-mono overflow-x-auto bg-slate-950 text-slate-200 max-h-48">
                      {f.content}
                    </pre>
                  </div>
                ))
              )}
            </div>
          )}

          {viewTab === 'preview' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white">
              <iframe
                title="VIP AI Live Code Preview"
                sandbox="allow-scripts"
                srcDoc={buildSandboxDoc()}
                className="w-full h-[420px] border-0"
              />
            </div>
          )}

          {explanation && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-2">
              <h4 className="font-display font-semibold text-sm">AI Engineering Notes</h4>
              <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                {explanation}
              </div>
            </div>
          )}
        </div>

        {/* Saved Code Projects */}
        <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h3 className="font-display font-semibold text-sm">{t.programming.savedList}</h3>
          {codeProjects.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2">
              {codeProjects.map((cp) => (
                <div
                  key={cp.id}
                  onClick={() => {
                    setTargetLanguage(cp.language);
                    setFilename(cp.mainFilename);
                    setCode(cp.mainCode);
                    setExplanation(cp.explanationMarkdown);
                    setPreviewHtml(cp.previewHtml || '');
                    setFiles(cp.files || []);
                  }}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-blue-500 cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{cp.title}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{cp.language}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCodeProjects((prev) => prev.filter((x) => x.id !== cp.id));
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
