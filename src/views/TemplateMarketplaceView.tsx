import React, { useState } from 'react';
import {
  Search,
  Bot,
  Gamepad2,
  Box,
  Film,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { ProjectTemplate } from '../types/vip';
import { playUiSound } from '../utils/soundFx';

const CURATED_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl_saas_crm',
    title: 'FinTrack Expense & Budget Web App',
    titleAr: 'تطبيق ويب لإدارة المصاريف والميزانية',
    category: 'webapp',
    description:
      'Responsive expense tracker with category filtering, dynamic bar charts, CSV export, and persistent state.',
    descriptionAr:
      'تطبيق متجاوب لإدارة المصاريف مع تصنيفات، رسوم بيانية تفاعلية، وتصدير CSV.',
    targetSection: 'developer',
    promptSeed:
      'Build a responsive expense and budget tracker web application with category filtering, interactive canvas bar breakdown chart, summary totals, and CSV export.',
  },
  {
    id: 'tpl_pwa_habit',
    title: 'Pulse Mobile Habit & Fitness PWA',
    titleAr: 'تطبيق جوال PWA لمتابعة العادات واللياقة',
    category: 'mobile',
    description:
      'Mobile-first progressive web app with offline manifest, daily streak tracker, hydration counter, and tactile dark UI.',
    descriptionAr:
      'تطبيق ويب للجوال مع دعم العمل دون اتصال، متابعة السلاسل اليومية وعداد النشاط.',
    targetSection: 'developer',
    promptSeed:
      'Create a mobile-first habit and workout tracker PWA with offline manifest.json, daily completion toggles, progress percentage ring, and local storage persistence.',
  },
  {
    id: 'tpl_ue5_desert',
    title: 'UE5 Desert Canyon Grappler (PC & Android)',
    titleAr: 'لعبة مغامرات صحراوية Unreal Engine 5 للكمبيوتر والأندرويد',
    category: 'game',
    description:
      'Third-person traversal blueprint with Enhanced Input touch & keyboard support, Lumen lighting, and grappling impulse C++.',
    descriptionAr:
      'لعبة منظور شخص ثالث تدعم اللمس ولوحة المفاتيح مع إضاءة Lumen وكود خطاف التسلق C++.',
    targetSection: 'game',
    promptSeed:
      'Design a 3D third-person desert canyon exploration game for PC and Android in Unreal Engine 5 featuring grappling hook traversal, dynamic Lumen golden hour lighting, and Enhanced Input mobile touch + keyboard controls.',
  },
  {
    id: 'tpl_ue5_racer',
    title: 'UE5 Neon Cyber Circuit Racer',
    titleAr: 'لعبة سباق مستقبلية في Unreal Engine 5',
    category: 'game',
    description:
      'Arcade-sim Chaos Vehicles racing architecture with drift boost, checkpoint replication, and track split-times.',
    descriptionAr:
      'لعبة سباقات فيزيائية بنظام Chaos Vehicles مع تعزيز الانجراف ونظام نقاط التفتيش.',
    targetSection: 'game',
    promptSeed:
      'Design a 3D futuristic street racing game for PC and Android using Unreal Engine 5 Chaos Vehicles with nitro drift boost, lap checkpoint manager, and wet neon asphalt reflections.',
  },
  {
    id: 'tpl_3d_drone',
    title: '3D Autonomous Reconnaissance Drone',
    titleAr: 'نموذج 3D لطائرة استطلاع ذاتية',
    category: '3d',
    description:
      'Quad-rotor tactical aerial drone with optical gimbal turret and brushed titanium arms ready for GLB/OBJ export.',
    descriptionAr:
      'طائرة درون رباعية المراوح مع كاميرا متوازنة جاهزة للتصدير بصيغة GLB و OBJ.',
    targetSection: 'threeD',
    promptSeed:
      'Create a sleek quad-rotor reconnaissance drone with four rotor rings, carbon body shell, optical camera sphere gimbal, and landing skids.',
  },
  {
    id: 'tpl_3d_tower',
    title: '3D Stylized Observatory Watchtower',
    titleAr: 'نموذج 3D لبرج مراقبة ومرصد فلكي',
    category: '3d',
    description:
      'Multi-tier observatory tower with rotating telescope dome and stone foundation for game environments.',
    descriptionAr:
      'برج مرصد متعدد الطوابق مع قبة تلسكوب دوارة وقاعدة صخرية لبيئات الألعاب.',
    targetSection: 'threeD',
    promptSeed:
      'Create an architectural observatory watchtower on a stone octagonal base with wooden balcony ring, rotating copper dome, and protruding telescope barrel.',
  },
  {
    id: 'tpl_vid_launch',
    title: 'Product Launch Cinematic Trailer',
    titleAr: 'إعلان تشويقي سينمائي لإطلاق منتج',
    category: 'video',
    description:
      '4-scene dramatic hardware reveal storyboard with crossfade transitions, narration script, and SRT timing.',
    descriptionAr:
      'قصة مصورة من 4 مشاهد لإطلاق منتج تقني مع انتقالات ناعمة ونص تعليق صوتي.',
    targetSection: 'video',
    promptSeed:
      'A sleek 12-second cinematic product launch teaser revealing an intelligent wearable device emerging from shadow into crisp studio rim lighting.',
  },
];

const CATEGORY_ICON: Record<ProjectTemplate['category'], React.ComponentType<{ className?: string }>> = {
  webapp: Bot,
  mobile: Bot,
  game: Gamepad2,
  '3d': Box,
  video: Film,
};

export function TemplateMarketplaceView() {
  const { t, isRtl, settings, setActiveSection, setPendingTemplatePrompt, logActivity } = useVip();
  const [category, setCategory] = useState<'all' | ProjectTemplate['category']>('all');
  const [search, setSearch] = useState('');

  const filtered = CURATED_TEMPLATES.filter((tpl) => {
    const matchCat = category === 'all' || tpl.category === category;
    const title = settings.language === 'ar' ? tpl.titleAr : tpl.title;
    const desc = settings.language === 'ar' ? tpl.descriptionAr : tpl.description;
    const q = search.trim().toLowerCase();
    return matchCat && (!q || title.toLowerCase().includes(q) || desc.toLowerCase().includes(q));
  });

  const handleUseTemplate = (tpl: ProjectTemplate) => {
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
    setPendingTemplatePrompt({ section: tpl.targetSection, prompt: tpl.promptSeed });
    logActivity('Loaded Template', settings.language === 'ar' ? tpl.titleAr : tpl.title);
    setActiveSection(tpl.targetSection);
  };

  const ArrowDir = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
          {t.templates.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t.templates.subtitle}
        </p>
      </div>

      {/* Category & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['all', 'webapp', 'mobile', 'game', '3d', 'video'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap capitalize ${
                category === cat
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat === 'all' ? t.templates.allCategories : cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.common.search}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 ps-8 pe-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((tpl) => {
          const Icon = CATEGORY_ICON[tpl.category];
          const title = settings.language === 'ar' ? tpl.titleAr : tpl.title;
          const desc = settings.language === 'ar' ? tpl.descriptionAr : tpl.description;

          return (
            <div
              key={tpl.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-mono uppercase text-slate-500">{tpl.category}</span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleUseTemplate(tpl)}
                className="w-full py-2 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span>{t.templates.useTemplate}</span>
                <ArrowDir className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
