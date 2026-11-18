import React, { useState } from 'react';
import {
  Lightbulb,
  Sparkles,
  Rocket,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { IdeaPlan, NavSection } from '../types/vip';
import { ProviderNotice } from '../components/ProviderNotice';
import { playUiSound } from '../utils/soundFx';

export function IdeaGeneratorView() {
  const { t, settings, ideas, setIdeas, setPendingTemplatePrompt, setActiveSection, logActivity, triggerMascot } =
    useVip();
  const isAr = settings.language === 'ar';

  const [seedIdea, setSeedIdea] = useState('');
  const [focus, setFocus] = useState('SaaS & Mobile Product');
  const [activeIdea, setActiveIdea] = useState<IdeaPlan | null>(ideas[0] || null);
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!seedIdea.trim() || generating) return;
    setGenerating(true);
    setErrorMsg(null);
    setErrorCode(null);
    try {
      const res = await fetch('/api/ai/ideas/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedIdea, focus, language: settings.language }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Idea expansion failed');
        setErrorCode(data.code || null);
        return;
      }

      const raw = data.idea || {};
      const validTargets = new Set(['developer', 'websiteCreator', 'presentations', 'game']);
      const target = validTargets.has(raw.launchTarget) ? raw.launchTarget : 'developer';

      const plan: IdeaPlan = {
        id: `idea_${Date.now()}`,
        seedIdea: seedIdea.trim(),
        title: raw.title || seedIdea.slice(0, 40),
        tagline: raw.tagline || '',
        valueProposition: raw.valueProposition || '',
        targetAudience: raw.targetAudience || '',
        architectureSpec: raw.architectureSpec || '',
        milestones: Array.isArray(raw.milestones) ? raw.milestones : [],
        risks: Array.isArray(raw.risks) ? raw.risks : [],
        weekOneSprint: Array.isArray(raw.weekOneSprint) ? raw.weekOneSprint : [],
        launchTarget: target,
        updatedAt: new Date().toISOString(),
      };
      setActiveIdea(plan);
      setIdeas((prev) => [plan, ...prev]);
      logActivity('Generated Project Plan', plan.title);
      triggerMascot('celebrate', plan.title);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setGenerating(false);
    }
  };

  const launchInStudio = (section: NavSection, idea: IdeaPlan) => {
    const promptSeed = `${idea.title}: ${idea.valueProposition}\nArchitecture: ${idea.architectureSpec}`;
    setPendingTemplatePrompt({ section, prompt: promptSeed });
    setActiveSection(section);
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
          {t.nav.ideaGenerator}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {isAr
            ? 'حوّل فكرتك الأولية إلى خارطة طريق كاملة ومعمارية ومهام أسبوع أول مع إطلاق مباشر للاستوديوهات'
            : 'Transform simple seed ideas into detailed product roadmaps, architecture specs & 1-click studio builds'}
        </p>
      </div>

      {/* Seed Input */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
        <div className="lg:col-span-7 space-y-1.5">
          <label className="block text-xs font-semibold">{isAr ? 'الفكرة الأولية' : 'Seed Idea'}</label>
          <textarea
            rows={2}
            value={seedIdea}
            onChange={(e) => setSeedIdea(e.target.value)}
            placeholder={
              isAr
                ? 'مثال: منصة ذكية لتتبع صيانة السيارات والتنبيه التلقائي لمواعيد الغيار...'
                : 'Example: An AI workout coach for travelers that builds 15-minute hotel-room routines...'
            }
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-sm"
          />
        </div>
        <div className="lg:col-span-3 space-y-1.5">
          <label className="block text-xs text-slate-500">{isAr ? 'المجال' : 'Focus Domain'}</label>
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs font-medium"
          >
            <option value="SaaS & Mobile Product">SaaS / Mobile App</option>
            <option value="AI & Automation Tool">AI &amp; Automation</option>
            <option value="Indie UE5 Game">Game Concept (UE5)</option>
            <option value="E-Commerce & Brand">Business / Website</option>
          </select>
        </div>
        <div className="lg:col-span-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !seedIdea.trim()}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isAr ? 'توسيع الفكرة' : 'Expand Idea'}</span>
          </button>
        </div>
      </div>

      {errorMsg && <ProviderNotice error={errorMsg} code={errorCode} />}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          {activeIdea ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-display font-bold text-lg">{activeIdea.title}</h3>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{activeIdea.tagline}</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => launchInStudio('developer', activeIdea)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    <span>{isAr ? 'بناء في وكيل التطوير' : 'Build App'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => launchInStudio('websiteCreator', activeIdea)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.nav.websiteCreator}
                  </button>
                  <button
                    type="button"
                    onClick={() => launchInStudio('presentations', activeIdea)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {t.nav.presentations}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="font-semibold text-slate-500">{isAr ? 'القيمة المقترحة' : 'Value Proposition'}</p>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{activeIdea.valueProposition}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <p className="font-semibold text-slate-500">{isAr ? 'الجمهور المستهدف' : 'Target Audience'}</p>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">{activeIdea.targetAudience}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-display font-semibold text-sm">{isAr ? 'المعمارية التقنية' : 'Technical Architecture'}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {activeIdea.architectureSpec}
                </p>
              </div>

              <div className="space-y-2.5">
                <h4 className="font-display font-semibold text-sm">{isAr ? 'مراحل التنفيذ' : 'Execution Milestones'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeIdea.milestones.map((m, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-1.5 text-xs">
                      <p className="font-bold text-blue-600 dark:text-blue-400">{m.phase}</p>
                      <p className="font-medium">{m.goal}</p>
                      <ul className="list-disc ps-4 text-slate-500 space-y-0.5">
                        {(m.deliverables || []).map((d, di) => (
                          <li key={di}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div className="space-y-1.5">
                  <h5 className="font-semibold text-emerald-500 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'سباق الأسبوع الأول' : 'Week-1 Sprint Actions'}</span>
                  </h5>
                  <ul className="list-disc ps-4 space-y-1 text-slate-600 dark:text-slate-400">
                    {activeIdea.weekOneSprint.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-1.5">
                  <h5 className="font-semibold text-amber-500 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{isAr ? 'المخاطر والحلول' : 'Key Risks & Mitigations'}</span>
                  </h5>
                  <ul className="list-disc ps-4 space-y-1 text-slate-600 dark:text-slate-400">
                    {activeIdea.risks.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-2 text-xs text-slate-500">
              <Lightbulb className="w-8 h-8 mx-auto text-slate-400" />
              <p>{isAr ? 'اكتب فكرة بسيطة أعلاه لبناء خطة عمل كاملة.' : 'Enter a seed idea above to generate a complete product blueprint & studio launcher.'}</p>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-4 space-y-3 h-fit">
          <h4 className="font-display font-semibold text-sm">{isAr ? 'الأفكار المحفوظة' : 'Saved Project Plans'}</h4>
          {ideas.length === 0 ? (
            <p className="text-xs text-slate-500">{t.common.empty}</p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {ideas.map((idItem) => (
                <div
                  key={idItem.id}
                  onClick={() => setActiveIdea(idItem)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 text-xs ${
                    activeIdea?.id === idItem.id ? 'border-blue-500 bg-blue-600/10' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{idItem.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{idItem.tagline}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIdeas((prev) => prev.filter((x) => x.id !== idItem.id));
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
