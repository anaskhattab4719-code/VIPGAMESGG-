import React, { useState, useEffect } from 'react';
import {
  Presentation,
  Sparkles,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { PresentationDeck, PresentationSlide } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { exportPptxBlob } from '../utils/officeExport';
import { playUiSound } from '../utils/soundFx';

const STARTER_DECK: PresentationDeck = {
  id: 'starter_deck_vip',
  title: 'VIP AI Platform Architecture',
  audience: 'Technical & Executive Stakeholders',
  themeColor: '#2563EB',
  updatedAt: new Date().toISOString(),
  slides: [
    {
      id: 'sl_1',
      title: 'VIP AI Super Platform',
      subtitle: 'Unified Creation Studio built by Anas Ali',
      layout: 'title',
      bullets: ['Multi-Agent Orchestration', 'Unreal Engine 5 & 3D Asset Pipeline', 'Documents, Data & Web Creation'],
      speakerNotes: 'Introduce the platform architecture and bilingual Arabic/English support.',
    },
    {
      id: 'sl_2',
      title: 'Key Capabilities',
      subtitle: 'End-to-End Engineering & Media Production',
      layout: 'bullets',
      bullets: [
        'Autonomous app builder with live sandbox testing & automated repair',
        'Grounded VIP Browser with verified citations',
        'Native OOXML .DOCX & .PPTX export directly from the studio',
      ],
      speakerNotes: 'Highlight real outputs without placeholders.',
    },
  ],
};

export function PresentationMakerView() {
  const {
    t,
    settings,
    presentations,
    setPresentations,
    pendingTemplatePrompt,
    setPendingTemplatePrompt,
    logActivity,
    triggerMascot,
  } = useVip();
  const isAr = settings.language === 'ar';

  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('Executive & Product Team');
  const [slideCount, setSlideCount] = useState(7);
  const [themeColor, setThemeColor] = useState('#2563EB');

  const [deck, setDeck] = useState<PresentationDeck>(presentations[0] || STARTER_DECK);
  const [selectedSlideIdx, setSelectedSlideIdx] = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genImageLoading, setGenImageLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (pendingTemplatePrompt?.section === 'presentations') {
      setTopic(pendingTemplatePrompt.prompt);
      setPendingTemplatePrompt(null);
    }
  }, [pendingTemplatePrompt, setPendingTemplatePrompt]);

  const upsertDeck = (nextDeck: PresentationDeck) => {
    setDeck(nextDeck);
    setPresentations((prev) => {
      const exists = prev.some((d) => d.id === nextDeck.id);
      return exists ? prev.map((d) => (d.id === nextDeck.id ? nextDeck : d)) : [nextDeck, ...prev];
    });
  };

  const handleGenerateDeck = async () => {
    if (!topic.trim() || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/ai/presentation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, audience, slideCount, themeColor, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Presentation generation failed');
        setErrorCode(data.code || null);
        return;
      }

      const slides: PresentationSlide[] = (Array.isArray(data.deck?.slides) ? data.deck.slides : []).map(
        (s: Partial<PresentationSlide>, idx: number) => ({
          id: `sl_${Date.now()}_${idx}`,
          title: s.title || `Slide ${idx + 1}`,
          subtitle: s.subtitle || '',
          layout: s.layout || 'bullets',
          bullets: Array.isArray(s.bullets) ? s.bullets : [],
          speakerNotes: s.speakerNotes || '',
          imagePrompt: s.imagePrompt || '',
        })
      );

      const newDeck: PresentationDeck = {
        id: `ppt_${Date.now()}`,
        title: data.deck?.title || topic.slice(0, 42),
        audience: data.deck?.audience || audience,
        themeColor,
        slides,
        updatedAt: new Date().toISOString(),
      };
      upsertDeck(newDeck);
      setSelectedSlideIdx(0);
      logActivity('Created Presentation Deck', newDeck.title);
      triggerMascot('celebrate', newDeck.title);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSlideImage = async () => {
    const curSlide = deck.slides[selectedSlideIdx];
    if (!curSlide || genImageLoading) return;
    setGenImageLoading(true);
    setErrorMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/ai/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: curSlide.imagePrompt || `${curSlide.title}: ${curSlide.bullets.join(', ')}`,
          style: '3d',
          aspectRatio: '16:9',
          quality: 'standard',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Slide image generation failed');
        setErrorCode(data.code || null);
        return;
      }
      const nextDeck: PresentationDeck = {
        ...deck,
        slides: deck.slides.map((s, idx) => (idx === selectedSlideIdx ? { ...s, imageDataUrl: data.imageDataUrl } : s)),
        updatedAt: new Date().toISOString(),
      };
      upsertDeck(nextDeck);
      playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenImageLoading(false);
    }
  };

  const handleExportPptx = async () => {
    const blob = await exportPptxBlob(deck);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.title.replace(/\s+/g, '_')}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const activeSlide = deck.slides[selectedSlideIdx] || deck.slides[0];

  const updateActiveSlide = (patch: Partial<PresentationSlide>) => {
    if (!activeSlide) return;
    upsertDeck({
      ...deck,
      slides: deck.slides.map((s, i) => (i === selectedSlideIdx ? { ...s, ...patch } : s)),
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
            {t.nav.presentations}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'توليد وتعديل العروض التقديمية، وضع العرض الكامل وتصدير ملف PowerPoint حقيقي .PPTX'
              : 'Generate & edit presentation decks, speaker notes, presenter mode & real .PPTX PowerPoint export'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPresenting((p) => !p)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {presenting ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span>{presenting ? (isAr ? 'خروج من العرض' : 'Exit Presenter') : isAr ? 'وضع المقدم' : 'Presenter View'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportPptx}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير PowerPoint (.pptx)' : 'Export .PPTX'}</span>
          </button>
        </div>
      </div>

      {/* Generator Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-6 space-y-2">
          <label className="block text-xs font-semibold">{isAr ? 'موضوع العرض التقديمي' : 'Presentation Topic'}</label>
          <textarea
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              isAr
                ? 'مثال: خطة إطلاق منصة تجارة إلكترونية مدعومة بالذكاء الاصطناعي لعام 2026...'
                : 'Example: Q4 Product Launch Strategy for an AI Analytics Startup...'
            }
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="lg:col-span-6 grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{isAr ? 'الجمهور' : 'Audience'}</label>
            <input
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{isAr ? 'الشرائح' : 'Slides'}</label>
            <input
              type="number"
              min={3}
              max={14}
              value={slideCount}
              onChange={(e) => setSlideCount(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{isAr ? 'اللون' : 'Theme'}</label>
            <input
              type="color"
              value={themeColor}
              onChange={(e) => {
                setThemeColor(e.target.value);
                upsertDeck({ ...deck, themeColor: e.target.value });
              }}
              className="w-full h-8 rounded border border-slate-700 bg-transparent cursor-pointer"
            />
          </div>
          <button
            type="button"
            onClick={handleGenerateDeck}
            disabled={generating || !topic.trim()}
            className="col-span-2 sm:col-span-4 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isAr ? 'توليد العرض التقديمي' : 'Generate Slide Deck'}</span>
          </button>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      {/* Presenter Fullscreen Overlay */}
      {presenting && activeSlide && (
        <div className="fixed inset-0 z-50 bg-[#090C12] text-white flex flex-col justify-between p-6 sm:p-12">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">
              {deck.title} — {selectedSlideIdx + 1} / {deck.slides.length}
            </span>
            <button
              type="button"
              onClick={() => setPresenting(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs hover:bg-slate-800"
            >
              {t.common.close}
            </button>
          </div>

          <div className="max-w-5xl mx-auto w-full rounded-2xl border border-slate-800 bg-[#111726] p-8 sm:p-12 space-y-6" style={{ borderTopColor: deck.themeColor, borderTopWidth: 6 }}>
            <h2 className="font-display font-bold text-3xl sm:text-5xl">{activeSlide.title}</h2>
            {activeSlide.subtitle && <p className="text-lg text-slate-400">{activeSlide.subtitle}</p>}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <ul className={`${activeSlide.imageDataUrl ? 'md:col-span-7' : 'md:col-span-12'} space-y-3 text-base sm:text-xl text-slate-200 list-disc ps-6`}>
                {activeSlide.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {activeSlide.imageDataUrl && (
                <img src={activeSlide.imageDataUrl} alt={activeSlide.title} className="md:col-span-5 rounded-xl border border-slate-700 w-full object-cover" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between max-w-5xl mx-auto w-full gap-4">
            <p className="text-xs text-slate-400 truncate max-w-xl">
              {isAr ? 'ملاحظات المقدم:' : 'Speaker Notes:'} {activeSlide.speakerNotes}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSlideIdx((i) => Math.max(0, i - 1))}
                disabled={selectedSlideIdx === 0}
                className="p-2.5 rounded-lg border border-slate-700 disabled:opacity-30 hover:bg-slate-800"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlideIdx((i) => Math.min(deck.slides.length - 1, i + 1))}
                disabled={selectedSlideIdx >= deck.slides.length - 1}
                className="p-2.5 rounded-lg border border-slate-700 disabled:opacity-30 hover:bg-slate-800"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide Navigator + Canvas + Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Slides Sidebar */}
        <aside className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-3 space-y-2 h-fit">
          <div className="flex items-center justify-between px-1">
            <h4 className="font-display font-semibold text-xs uppercase tracking-wide text-slate-500">
              {isAr ? 'الشرائح' : 'Slides'} ({deck.slides.length})
            </h4>
            <button
              type="button"
              onClick={() => {
                const newSlide: PresentationSlide = {
                  id: `sl_${Date.now()}`,
                  title: isAr ? 'شريحة جديدة' : 'New Slide',
                  subtitle: '',
                  layout: 'bullets',
                  bullets: [isAr ? 'نقطة رئيسية أولى' : 'First key point'],
                  speakerNotes: '',
                };
                const next = { ...deck, slides: [...deck.slides, newSlide] };
                upsertDeck(next);
                setSelectedSlideIdx(next.slides.length - 1);
              }}
              className="p-1.5 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600/20"
              title={t.common.create}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1.5 max-h-[460px] overflow-y-auto">
            {deck.slides.map((sl, idx) => (
              <div
                key={sl.id}
                onClick={() => setSelectedSlideIdx(idx)}
                className={`p-2.5 rounded-lg border cursor-pointer flex items-center justify-between gap-2 text-xs ${
                  selectedSlideIdx === idx
                    ? 'border-blue-500 bg-blue-600/10'
                    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="min-w-0">
                  <span className="font-mono text-[10px] text-slate-400 me-1.5">{idx + 1}.</span>
                  <span className="font-semibold truncate">{sl.title}</span>
                </div>
                {deck.slides.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const filtered = deck.slides.filter((_, i) => i !== idx);
                      upsertDeck({ ...deck, slides: filtered });
                      setSelectedSlideIdx(Math.max(0, Math.min(selectedSlideIdx, filtered.length - 1)));
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Active Slide Stage & Editor */}
        <div className="lg:col-span-9 space-y-4">
          {activeSlide && (
            <>
              {/* 16:9 Slide Visual Stage */}
              <div
                className="rounded-2xl border border-slate-800 bg-[#0F172A] text-white p-6 sm:p-10 aspect-[16/9] flex flex-col justify-between overflow-hidden relative"
                style={{ borderTop: `6px solid ${deck.themeColor}` }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{deck.title}</span>
                    <span>
                      {selectedSlideIdx + 1} / {deck.slides.length}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-xl sm:text-3xl leading-tight">{activeSlide.title}</h3>
                  {activeSlide.subtitle && <p className="text-xs sm:text-sm text-slate-300">{activeSlide.subtitle}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center my-auto py-3">
                  <ul className={`${activeSlide.imageDataUrl ? 'md:col-span-7' : 'md:col-span-12'} space-y-2 text-xs sm:text-base text-slate-200 list-disc ps-5`}>
                    {activeSlide.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  {activeSlide.imageDataUrl && (
                    <img
                      src={activeSlide.imageDataUrl}
                      alt={activeSlide.title}
                      className="md:col-span-5 rounded-xl border border-slate-700 w-full max-h-48 object-cover"
                    />
                  )}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span className="truncate">{activeSlide.speakerNotes}</span>
                </div>
              </div>

              {/* Slide Editor Controls */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <label className="block font-semibold">{isAr ? 'عنوان الشريحة' : 'Slide Title'}</label>
                  <input
                    value={activeSlide.title}
                    onChange={(e) => updateActiveSlide({ title: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                  />
                  <label className="block font-semibold pt-1">{isAr ? 'العنوان الفرعي' : 'Subtitle'}</label>
                  <input
                    value={activeSlide.subtitle || ''}
                    onChange={(e) => updateActiveSlide({ subtitle: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                  />
                  <label className="block font-semibold pt-1">{isAr ? 'ملاحظات المقدم' : 'Speaker Notes'}</label>
                  <textarea
                    rows={2}
                    value={activeSlide.speakerNotes}
                    onChange={(e) => updateActiveSlide({ speakerNotes: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold">
                    {isAr ? 'النقاط (سطر لكل نقطة)' : 'Bullet Points (one per line)'}
                  </label>
                  <textarea
                    rows={5}
                    value={activeSlide.bullets.join('\n')}
                    onChange={(e) =>
                      updateActiveSlide({
                        bullets: e.target.value.split('\n').filter((line) => line.length > 0),
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Presentation className="w-3.5 h-3.5" />
                      {activeSlide.layout}
                    </span>
                    <button
                      type="button"
                      onClick={handleGenerateSlideImage}
                      disabled={genImageLoading}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 font-medium"
                    >
                      {genImageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                      <span>{isAr ? 'توليد صورة للشريحة' : 'Generate Slide Image'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
