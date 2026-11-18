import React, { useState } from 'react';
import {
  MessageSquare,
  Bot,
  Gamepad2,
  Image as ImageIcon,
  Film,
  Box,
  AudioLines,
  Code2,
  Crown,
  FolderKanban,
  LayoutGrid,
  Settings,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  SlidersHorizontal,
  ArrowRight,
  ArrowLeft,
  MonitorCog,
  Globe,
  Presentation,
  FileText,
  Languages,
  GraduationCap,
  Workflow,
  LayoutTemplate,
  BarChart3,
  Lightbulb,
  Users,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { NavSection } from '../types/vip';
import { playUiSound } from '../utils/soundFx';

const STUDIO_ICONS: Record<Exclude<NavSection, 'home'>, React.ComponentType<{ className?: string }>> = {
  assistant: MessageSquare,
  developer: Bot,
  game: Gamepad2,
  image: ImageIcon,
  video: Film,
  threeD: Box,
  audio: AudioLines,
  programming: Code2,
  pcAssistant: MonitorCog,
  vipBrowser: Globe,
  presentations: Presentation,
  documents: FileText,
  translator: Languages,
  academy: GraduationCap,
  automation: Workflow,
  websiteCreator: LayoutTemplate,
  dataAnalyst: BarChart3,
  ideaGenerator: Lightbulb,
  multiAgent: Users,
  chess: Crown,
  projects: FolderKanban,
  templates: LayoutGrid,
  settings: Settings,
};

export function HomeView() {
  const {
    t,
    isRtl,
    setActiveSection,
    settings,
    updateSettings,
    conversations,
    devProjects,
    gameProjects,
    threeDProjects,
    imageHistory,
    videoProjects,
  } = useVip();

  const [customizing, setCustomizing] = useState(false);

  const sortedWidgets = [...settings.dashboardLayout].sort((a, b) => a.order - b.order);

  const moveWidget = (index: number, delta: -1 | 1) => {
    const next = [...sortedWidgets];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const normalized = next.map((w, idx) => ({ ...w, order: idx }));
    updateSettings({ dashboardLayout: normalized });
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const toggleWidget = (id: NavSection) => {
    const updated = sortedWidgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
    updateSettings({ dashboardLayout: updated });
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
  };

  const ArrowDir = isRtl ? ArrowLeft : ArrowRight;

  const statItems = [
    { label: t.home.stats.conversations, value: conversations.length, target: 'assistant' as NavSection },
    { label: t.home.stats.devApps, value: devProjects.length, target: 'developer' as NavSection },
    { label: t.home.stats.games, value: gameProjects.length, target: 'game' as NavSection },
    { label: t.home.stats.models3d, value: threeDProjects.length, target: 'threeD' as NavSection },
    { label: t.home.stats.images, value: imageHistory.length, target: 'image' as NavSection },
    { label: t.home.stats.videos, value: videoProjects.length, target: 'video' as NavSection },
  ];

  return (
    <div className="space-y-8">
      {/* Split Hero Banner */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {t.home.eyebrow}
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-4xl tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
              {t.home.headline}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              {t.home.subheadline}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                playUiSound('click', settings.soundEnabled, settings.soundVolume);
                setActiveSection('assistant');
              }}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span>{t.home.primaryCta}</span>
              <ArrowDir className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCustomizing((prev) => !prev)}
              className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                customizing
                  ? 'border-blue-500 bg-blue-600/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>{customizing ? t.home.doneCustomizing : t.home.secondaryCta}</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[220px] bg-slate-900">
          <img
            src="/src/assets/images/vip_workspace_hero_1794851150075.jpg"
            alt="VIP AI Creative Workstation"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        </div>
      </section>

      {/* Workspace Activity Strip (Real Counts, Tabular Numerals) */}
      <section aria-label={t.home.workspaceOverview}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {statItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActiveSection(item.target)}
              className="text-start p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] hover:border-blue-500/50 transition-colors"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.label}</p>
              <p className="mt-1 text-2xl font-display font-bold tabular-nums text-slate-900 dark:text-white">
                {item.value}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Customizable Studio Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-lg text-slate-900 dark:text-white">
            {t.home.studiosHeading}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {sortedWidgets.map((widget, index) => {
            if (widget.id === 'home') return null;
            if (!widget.visible && !customizing) return null;
            const key = widget.id as Exclude<NavSection, 'home'>;
            const Icon = STUDIO_ICONS[key];
            const description = t.home.cards[key];

            return (
              <div
                key={widget.id}
                className={`rounded-xl border p-5 flex flex-col justify-between gap-4 transition-colors ${
                  widget.visible
                    ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722]'
                    : 'border-dashed border-slate-300 dark:border-slate-800 bg-slate-100/50 dark:bg-[#0E121B] opacity-60'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    {customizing && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveWidget(index, -1)}
                          disabled={index === 0}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                          title={t.home.moveUp}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWidget(index, 1)}
                          disabled={index === sortedWidgets.length - 1}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"
                          title={t.home.moveDown}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleWidget(widget.id)}
                          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                          title={widget.visible ? t.home.hideWidget : t.home.showWidget}
                        >
                          {widget.visible ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                      {t.nav[key]}
                    </h4>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    playUiSound('click', settings.soundEnabled, settings.soundVolume);
                    setActiveSection(widget.id);
                  }}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700/80 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-medium transition-colors flex items-center justify-between"
                >
                  <span>{t.common.openStudio}</span>
                  <ArrowDir className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
