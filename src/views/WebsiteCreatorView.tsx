import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import {
  LayoutTemplate,
  Sparkles,
  Download,
  Loader2,
  Monitor,
  Tablet,
  Smartphone,
  Code2,
  Eye,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { WebsiteProject } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

const STARTER_WEBSITE: WebsiteProject = {
  id: 'starter_website_studio',
  name: 'Meridian Architecture Studio',
  stylePreset: 'Modern Editorial',
  summary: 'Responsive architectural firm portfolio landing page with adaptive grid & interactive project inquiry.',
  updatedAt: new Date().toISOString(),
  previewHtml: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Meridian Architecture</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
  body { background: #0B0E14; color: #F8FAFC; line-height: 1.6; }
  header { padding: 20px 6%; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1E293B; }
  .logo { font-weight: 800; font-size: 18px; letter-spacing: 0.04em; }
  .hero { padding: 64px 6%; max-width: 1120px; margin: 0 auto; display: grid; gap: 32px; }
  .hero h1 { font-size: clamp(2rem, 5vw, 3.6rem); line-height: 1.1; }
  .btn { display: inline-block; padding: 12px 24px; border-radius: 10px; background: #2563EB; color: #fff; text-decoration: none; font-weight: 600; margin-top: 18px; }
  .grid { padding: 32px 6% 64px; max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 18px; }
  .card { background: #131722; border: 1px solid #1E293B; border-radius: 14px; padding: 22px; }
  .card h3 { margin-bottom: 8px; font-size: 17px; }
  .card p { color: #94A3B8; font-size: 14px; }
</style>
</head>
<body>
  <header><div class="logo">MERIDIAN</div><nav style="font-size:13px;color:#94A3B8">Projects · Studio · Contact</nav></header>
  <section class="hero">
    <div>
      <h1>Timeless structures shaped for light &amp; climate.</h1>
      <p style="color:#94A3B8;margin-top:12px;max-width:560px">Residential pavilions, civic libraries, and passive-cooling desert courtyards engineered with precision.</p>
      <a class="btn" href="#work">Explore Portfolio</a>
    </div>
  </section>
  <section id="work" class="grid">
    <div class="card"><h3>Solstice Cultural Hall</h3><p>Passive shading facade &amp; acoustic timber atrium.</p></div>
    <div class="card"><h3>Al-Waha Residence</h3><p>Modular travertine courtyard with solar canopy.</p></div>
    <div class="card"><h3>Horizon Waterfront Lab</h3><p>Resilient marine-grade steel and glass research center.</p></div>
  </section>
</body>
</html>`,
  files: [{ path: 'index.html', language: 'html', content: '<!-- Synchronized with live previewHtml -->' }],
};

export function WebsiteCreatorView() {
  const { t, settings, websites, setWebsites, pendingTemplatePrompt, setPendingTemplatePrompt, logActivity, triggerMascot } =
    useVip();
  const isAr = settings.language === 'ar';

  const [prompt, setPrompt] = useState('');
  const [stylePreset, setStylePreset] = useState('Modern Editorial');
  const [site, setSite] = useState<WebsiteProject>(websites[0] || STARTER_WEBSITE);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (pendingTemplatePrompt?.section === 'websiteCreator') {
      setPrompt(pendingTemplatePrompt.prompt);
      setPendingTemplatePrompt(null);
    }
  }, [pendingTemplatePrompt, setPendingTemplatePrompt]);

  const handleGenerateSite = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/ai/website/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stylePreset, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Website generation failed');
        setErrorCode(data.code || null);
        return;
      }

      const raw = data.site || {};
      const nextSite: WebsiteProject = {
        id: `web_${Date.now()}`,
        name: raw.name || prompt.slice(0, 36),
        stylePreset,
        summary: raw.summary || '',
        previewHtml: raw.previewHtml || STARTER_WEBSITE.previewHtml,
        files: Array.isArray(raw.files) ? raw.files : [],
        updatedAt: new Date().toISOString(),
      };
      setSite(nextSite);
      setWebsites((prev) => [nextSite, ...prev]);
      setSelectedFileIdx(0);
      setTab('preview');
      logActivity('Generated Responsive Website', nextSite.name);
      triggerMascot('celebrate', nextSite.name);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportZip = async () => {
    const zip = new JSZip();
    zip.file('index.html', site.previewHtml);
    for (const f of site.files || []) {
      if (f.path !== 'index.html') zip.file(f.path, f.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${site.name.replace(/\s+/g, '_')}_Website.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const frameWidthClass = viewport === 'mobile' ? 'max-w-[390px]' : viewport === 'tablet' ? 'max-w-[768px]' : 'w-full';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.websiteCreator}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'إنشاء مواقع ويب متجاوبة مع معاينة الهاتف واللوحي والحاسوب وتصدير حزمة الكود .ZIP'
              : 'Responsive multi-section website generator with Desktop/Tablet/Mobile preview & .ZIP code export'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportZip}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isAr ? 'تصدير الموقع (.zip)' : 'Export Website (.zip)'}</span>
        </button>
      </div>

      {/* Generator Controls */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
        <div className="lg:col-span-7 space-y-1.5">
          <label className="block text-xs font-semibold">{isAr ? 'صِف الموقع المطلوب' : 'Describe your website'}</label>
          <textarea
            rows={2}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              isAr
                ? 'مثال: موقع تعريفي لوكالة تصميم وتطوير تطبيقات مع معرض أعمال ونموذج حجز استشارة...'
                : 'Example: Modern portfolio website for a boutique AI robotics lab with showcase cards & contact inquiry...'
            }
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm"
          />
        </div>
        <div className="lg:col-span-3 space-y-1.5">
          <label className="block text-xs text-slate-500">{isAr ? 'النمط البصري' : 'Design Preset'}</label>
          <select
            value={stylePreset}
            onChange={(e) => setStylePreset(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium"
          >
            <option value="Modern Editorial">Modern Editorial</option>
            <option value="SaaS Midnight">SaaS Midnight</option>
            <option value="Warm Studio Light">Warm Studio Light</option>
            <option value="Tech Brutalist">Tech Minimal</option>
          </select>
        </div>
        <div className="lg:col-span-2">
          <button
            type="button"
            onClick={handleGenerateSite}
            disabled={generating || !prompt.trim()}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isAr ? 'إنشاء الموقع' : 'Generate'}</span>
          </button>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Toolbar: Tabs + Responsive Breakpoints */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
              tab === 'preview' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{isAr ? 'معاينة حية' : 'Live Preview'}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('code')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
              tab === 'code' ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{isAr ? 'محرر الكود' : 'Code Editor'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-900">
          {(
            [
              { id: 'desktop', icon: Monitor },
              { id: 'tablet', icon: Tablet },
              { id: 'mobile', icon: Smartphone },
            ] as const
          ).map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setViewport(id)}
              className={`p-1.5 rounded text-xs ${viewport === id ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
              title={id}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-9">
          {tab === 'preview' ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-[#0E121B] p-4 flex justify-center">
              <iframe
                title={site.name}
                sandbox="allow-scripts"
                srcDoc={site.previewHtml}
                className={`${frameWidthClass} w-full h-[520px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white transition-all duration-200`}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedFileIdx(-1)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono ${selectedFileIdx === -1 ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                >
                  preview/index.html
                </button>
                {site.files.map((f, idx) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedFileIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono ${selectedFileIdx === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                  >
                    {f.path}
                  </button>
                ))}
              </div>
              <textarea
                rows={18}
                dir="ltr"
                value={selectedFileIdx === -1 ? site.previewHtml : site.files[selectedFileIdx]?.content || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (selectedFileIdx === -1) {
                    setSite((s) => ({ ...s, previewHtml: val }));
                  } else {
                    setSite((s) => ({
                      ...s,
                      files: s.files.map((f, i) => (i === selectedFileIdx ? { ...f, content: val } : f)),
                    }));
                  }
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 text-emerald-300 font-mono text-xs p-3.5"
              />
            </div>
          )}
        </div>

        <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-blue-500" />
            <span>{isAr ? 'المواقع المحفوظة' : 'Saved Websites'}</span>
          </h4>
          {websites.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {websites.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setSite(w)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 text-xs ${
                    site.id === w.id ? 'border-blue-500 bg-blue-600/10' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{w.name}</p>
                    <p className="text-[11px] text-slate-500">{w.stylePreset}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setWebsites((prev) => prev.filter((x) => x.id !== w.id));
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
