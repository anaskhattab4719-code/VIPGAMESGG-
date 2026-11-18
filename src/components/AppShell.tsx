import React, { useState } from 'react';
import {
  Home,
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
  LayoutTemplate,
  Settings,
  Menu,
  X,
  Sun,
  Moon,
  Languages,
  MonitorCog,
  Globe,
  Presentation,
  FileText,
  GraduationCap,
  Workflow,
  LayoutGrid,
  BarChart3,
  Lightbulb,
  Users,
  Search,
} from 'lucide-react';
import { useVip } from '../context/VipContext';
import { NavSection } from '../types/vip';
import { playUiSound } from '../utils/soundFx';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';

interface NavGroup {
  groupKey: 'core' | 'build' | 'media' | 'productivity' | 'workspace';
  items: Array<{ id: NavSection; icon: React.ComponentType<{ className?: string }> }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: 'core',
    items: [
      { id: 'home', icon: Home },
      { id: 'assistant', icon: MessageSquare },
      { id: 'developer', icon: Bot },
      { id: 'multiAgent', icon: Users },
      { id: 'ideaGenerator', icon: Lightbulb },
    ],
  },
  {
    groupKey: 'build',
    items: [
      { id: 'programming', icon: Code2 },
      { id: 'websiteCreator', icon: LayoutGrid },
      { id: 'automation', icon: Workflow },
      { id: 'pcAssistant', icon: MonitorCog },
    ],
  },
  {
    groupKey: 'media',
    items: [
      { id: 'game', icon: Gamepad2 },
      { id: 'threeD', icon: Box },
      { id: 'image', icon: ImageIcon },
      { id: 'video', icon: Film },
      { id: 'audio', icon: AudioLines },
    ],
  },
  {
    groupKey: 'productivity',
    items: [
      { id: 'vipBrowser', icon: Globe },
      { id: 'presentations', icon: Presentation },
      { id: 'documents', icon: FileText },
      { id: 'translator', icon: Languages },
      { id: 'dataAnalyst', icon: BarChart3 },
      { id: 'academy', icon: GraduationCap },
    ],
  },
  {
    groupKey: 'workspace',
    items: [
      { id: 'chess', icon: Crown },
      { id: 'projects', icon: FolderKanban },
      { id: 'templates', icon: LayoutTemplate },
      { id: 'settings', icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { activeSection, setActiveSection, t, settings, updateSettings, authUser, isRtl } = useVip();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');

  const handleSelect = (id: NavSection) => {
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
    setActiveSection(id);
    setMobileOpen(false);
  };

  const toggleTheme = () => {
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
    updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' });
  };

  const toggleLanguage = () => {
    playUiSound('click', settings.soundEnabled, settings.soundVolume);
    updateSettings({ language: settings.language === 'en' ? 'ar' : 'en' });
  };

  const renderNavGroups = (closeDrawer = false) => {
    const q = navSearch.trim().toLowerCase();
    return NAV_GROUPS.map((grp) => {
      const visibleItems = grp.items.filter(
        ({ id }) => !q || t.nav[id].toLowerCase().includes(q) || id.toLowerCase().includes(q)
      );
      if (visibleItems.length === 0) return null;
      return (
        <div key={grp.groupKey} className="space-y-1 pb-2">
          <p className="px-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t.navGroups[grp.groupKey]}
          </p>
          {visibleItems.map(({ id, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  handleSelect(id);
                  if (closeDrawer) setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.nav[id]}</span>
              </button>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 shrink-0 border-e border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#11151F] sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => handleSelect('home')}
            className="flex items-center gap-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white font-display font-bold text-sm flex items-center justify-center shrink-0">
              V
            </span>
            <span className="font-display font-bold text-lg tracking-tight whitespace-nowrap">
              {t.brand}
            </span>
          </button>
        </div>

        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5" />
            <input
              value={navSearch}
              onChange={(e) => setNavSearch(e.target.value)}
              placeholder={t.common.search}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 ps-8 pe-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1" aria-label="Main navigation">
          {renderNavGroups(false)}
        </nav>

        {/* Creator Profile Footer */}
        <button
          type="button"
          onClick={() => handleSelect('settings')}
          className="p-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-3 hover:bg-slate-100 dark:hover:bg-slate-800/50 text-start transition-colors"
        >
          <img
            src={settings.userAvatar}
            alt={authUser?.name || settings.userName}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-800"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">
              {authUser?.name || settings.userName}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {authUser ? authUser.email : settings.userRole}
            </p>
          </div>
        </button>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className={`relative z-10 w-72 max-w-[85vw] bg-white dark:bg-[#11151F] h-full flex flex-col border-e border-slate-200 dark:border-slate-800 ${
              isRtl ? 'mr-0' : 'ml-0'
            }`}
          >
            <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
              <span className="font-display font-bold text-lg">{t.brand}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-3 pt-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-2.5" />
                <input
                  value={navSearch}
                  onChange={(e) => setNavSearch(e.target.value)}
                  placeholder={t.common.search}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 ps-8 pe-2.5 py-1.5 text-xs focus:outline-none"
                />
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {renderNavGroups(true)}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 lg:h-16 px-4 lg:px-8 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B0E14]/85 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ms-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="lg:hidden font-display font-bold text-slate-900 dark:text-white whitespace-nowrap">
                {t.brand}
              </span>
              <span className="lg:hidden text-slate-400">/</span>
              <h1 className="font-display font-semibold text-base lg:text-lg text-slate-900 dark:text-white truncate">
                {t.nav[activeSection]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title={t.settings.languageLabel}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{settings.language === 'en' ? 'العربية' : 'English'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label={t.settings.themeLabel}
              title={t.settings.themeLabel}
            >
              {settings.theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <PWAInstallButton />

            <button
              type="button"
              onClick={() => handleSelect('developer')}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{t.nav.developer}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
      <OfflineIndicator />
    </div>
  );
}
