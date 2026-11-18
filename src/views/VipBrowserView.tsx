import React, { useState } from 'react';
import {
  Globe,
  Search,
  Link2,
  ExternalLink,
  Loader2,
  Download,
  Copy,
  Check,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { BrowserResearchItem } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

export function VipBrowserView() {
  const { t, settings, browserHistory, setBrowserHistory, logActivity } = useVip();
  const isAr = settings.language === 'ar';

  const [mode, setMode] = useState<'search' | 'url'>('search');
  const [query, setQuery] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<BrowserResearchItem | null>(browserHistory[0] || null);
  const [copied, setCopied] = useState(false);

  const handleResearch = async () => {
    if (loading) return;
    if (mode === 'search' && !query.trim()) return;
    if (mode === 'url' && !urlInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setErrorCode(null);

    try {
      const res = await fetch('/api/ai/browser/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          query: query.trim(),
          url: urlInput.trim(),
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Web research failed.');
        setErrorCode(data.code || null);
        return;
      }

      const item: BrowserResearchItem = {
        id: `web_${Date.now()}`,
        mode,
        query: query.trim() || urlInput.trim(),
        url: mode === 'url' ? urlInput.trim() : undefined,
        summary: data.summary || '',
        citations: Array.isArray(data.citations) ? data.citations : [],
        createdAt: new Date().toISOString(),
      };
      setActiveItem(item);
      setBrowserHistory((prev) => [item, ...prev]);
      logActivity('VIP Browser Research', item.query);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const exportMarkdown = (item: BrowserResearchItem) => {
    const md = `# ${item.query}\n\n${item.url ? `Source URL: ${item.url}\n\n` : ''}${item.summary}\n\n## Verified Citations\n${item.citations
      .map((c) => `- [${c.title}](${c.uri})`)
      .join('\n')}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VIP_Browser_Research_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.vipBrowser}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'بحث ويب فوري مدعوم بمصادر وروابط Google Search الموثقة وتلخيص روابط المواقع'
              : 'AI-powered live web research backed by Google Search citations & webpage URL summarization'}
          </p>
        </div>

        <div className="flex items-center p-1 rounded-lg bg-slate-200/80 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode('search')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 ${
              mode === 'search' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>{isAr ? 'بحث الويب الحي' : 'Live Web Search'}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 ${
              mode === 'url' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{isAr ? 'قراءة وتلخيص رابط URL' : 'Summarize URL'}</span>
          </button>
        </div>
      </div>

      {/* Browser Address & Search Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
        {mode === 'url' && (
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-500 shrink-0" />
            <input
              type="url"
              dir="ltr"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResearch()}
            placeholder={
              mode === 'url'
                ? isAr
                  ? 'ما النقطة التي تريد التركيز عليها في هذه الصفحة؟ (اختياري)'
                  : 'Optional question or focus area for this webpage...'
                : isAr
                  ? 'ابحث في الويب مباشرة (مثال: أحدث ميزات Unreal Engine 5.5 أو أخبار التقنية اليوم)...'
                  : 'Search the live web with citations (e.g. Latest Unreal Engine 5.5 features & benchmarks)...'
            }
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={handleResearch}
            disabled={loading || (mode === 'search' ? !query.trim() : !urlInput.trim())}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
            <span>{mode === 'url' ? (isAr ? 'تحليل الصفحة' : 'Analyze URL') : isAr ? 'بحث موثّق' : 'Search Web'}</span>
          </button>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 space-y-4">
          {activeItem ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-base truncate">{activeItem.query}</h3>
                  {activeItem.url && (
                    <a
                      href={activeItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-blue-500 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{activeItem.url}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(activeItem.summary);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs inline-flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? t.common.copied : t.common.copy}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportMarkdown(activeItem)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.MD</span>
                  </button>
                </div>
              </div>

              <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {activeItem.summary}
              </div>

              {activeItem.citations.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {isAr ? 'المصادر والروابط الموثّقة' : 'Verified Web Citations'}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeItem.citations.map((cit, idx) => (
                      <a
                        key={idx}
                        href={cit.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-blue-500 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="truncate font-medium text-blue-600 dark:text-blue-400">{cit.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center space-y-2 text-xs text-slate-500">
              <BookOpen className="w-7 h-7 mx-auto text-slate-400" />
              <p>{isAr ? 'ابدأ بالبحث في الويب أو إدخال رابط مقال لتلخيصه بالمصادر.' : 'Search any topic or summarize a webpage URL with verified citations.'}</p>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm">{isAr ? 'سجل البحث والقراءة' : 'Research History'}</h4>
          {browserHistory.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {browserHistory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveItem(item)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 ${
                    activeItem?.id === item.id
                      ? 'border-blue-500 bg-blue-600/10'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{item.query}</p>
                    <p className="text-[11px] text-slate-500">
                      {item.mode.toUpperCase()} · {item.citations.length} {isAr ? 'مصدر' : 'sources'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBrowserHistory((prev) => prev.filter((x) => x.id !== item.id));
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
