import React, { useState } from 'react';
import {
  Languages,
  Moon,
  Sun,
  Volume2,
  Bot,
  User,
  Shield,
  Server,
  Download,
  Trash2,
  RotateCcw,
  LogIn,
  LogOut,
  UserPlus,
  Smartphone,
  Sparkles,
  Package,
} from 'lucide-react';
import JSZip from 'jszip';
import { useVip } from '../context/VipContext';
import { playUiSound } from '../utils/soundFx';
import { showNativeSplash } from '../utils/nativeSplash';
import { PWAInstallButton } from '../components/PWAInstallButton';
import {
  DEFAULT_BACKEND_URL,
  getActiveBackendUrl,
  isNativePlatform,
  setCustomBackendUrl,
} from '../utils/apiBridge';

export function SettingsView() {
  const {
    t,
    settings,
    updateSettings,
    authUser,
    setAuthSession,
    serverHealth,
    conversations,
    devProjects,
    gameProjects,
    threeDProjects,
    imageHistory,
    videoProjects,
    audioHistory,
    codeProjects,
    clearAllConversations,
    resetWorkspace,
  } = useVip();

  const [confirmReset, setConfirmReset] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [backendInput, setBackendInput] = useState<string>(() => getActiveBackendUrl());
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [packingKit, setPackingKit] = useState(false);
  const [previewingSplash, setPreviewingSplash] = useState(false);

  const downloadAssetFile = async (assetPath: string, fileName: string) => {
    const res = await fetch(assetPath);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  const downloadAndroidKitZip = async () => {
    if (packingKit) return;
    setPackingKit(true);
    try {
      const zip = new JSZip();
      const assets = [
        { src: '/vip-ai-icon-1024.png', dest: 'icons/vip-ai-icon-1024.png' },
        { src: '/vip-ai-icon-512.png', dest: 'icons/vip-ai-icon-512-playstore.png' },
        { src: '/vip-ai-adaptive-icon.png', dest: 'icons/vip-ai-adaptive-foreground-432.png' },
        { src: '/vip-ai-splash-logo.png', dest: 'splash/vip-ai-splash-logo-1024.png' },
        { src: '/vip-ai-splash-screen.png', dest: 'splash/vip-ai-splash-screen-1080x1920.png' },
      ];
      await Promise.all(
        assets.map(async (item) => {
          const res = await fetch(item.src);
          const buf = await res.arrayBuffer();
          zip.file(item.dest, buf);
        }),
      );
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vip-ai-android-icon-splash-kit.zip';
      a.click();
      URL.revokeObjectURL(url);
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } finally {
      setPackingKit(false);
    }
  };

  const triggerSplashPreview = async () => {
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
    if (isNativePlatform()) {
      await showNativeSplash(1800);
      return;
    }
    setPreviewingSplash(true);
    window.setTimeout(() => setPreviewingSplash(false), 1800);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword || authLoading) return;
    setAuthLoading(true);
    setAuthError(null);

    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: settings.userName,
          role: settings.userRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed.');
        return;
      }
      setAuthSession(data.user, data.token);
      setAuthPassword('');
      playUiSound('win', settings.soundEnabled, settings.soundVolume);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setAuthLoading(false);
    }
  };

  const exportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      conversations,
      devProjects,
      gameProjects,
      threeDProjects,
      imageHistory,
      videoProjects,
      audioHistory,
      codeProjects,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vip_ai_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    playUiSound('pop', settings.soundEnabled, settings.soundVolume);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
          {t.settings.title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t.settings.subtitle}
        </p>
      </div>

      {/* Appearance & Language */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <h3 className="font-display font-semibold text-base flex items-center gap-2">
          <Languages className="w-4 h-4 text-blue-500" />
          <span>{t.settings.appearance}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-500">
              {t.settings.languageLabel}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ language: 'en' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  settings.language === 'en'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                English (LTR)
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ language: 'ar' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                  settings.language === 'ar'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                العربية (RTL)
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-500">
              {t.settings.themeLabel}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                  settings.theme === 'dark'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>{t.settings.dark}</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'light' })}
                className={`py-2 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
                  settings.theme === 'light'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>{t.settings.light}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Sound Controls */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <h3 className="font-display font-semibold text-base flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-blue-500" />
          <span>{t.settings.audioTitle}</span>
        </h3>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => updateSettings({ soundEnabled: e.target.checked })}
            />
            <span>{t.settings.soundEffects}</span>
          </label>

          <div className="flex items-center gap-3 min-w-[200px]">
            <span className="text-xs text-slate-500">{t.settings.volume}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.soundVolume}
              onChange={(e) => updateSettings({ soundVolume: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="font-mono tabular-nums text-xs w-9 text-end">
              {Math.round(settings.soundVolume * 100)}%
            </span>
          </div>
        </div>
      </section>

      {/* Animated Mascot Controls */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <h3 className="font-display font-semibold text-base flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-500" />
          <span>{t.settings.mascotTitle}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <span>{t.settings.mascotVisible}</span>
            <input
              type="checkbox"
              checked={settings.mascotVisible}
              onChange={(e) => updateSettings({ mascotVisible: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <span>{t.settings.mascotPatrol}</span>
            <input
              type="checkbox"
              checked={settings.mascotPatrol}
              onChange={(e) => updateSettings({ mascotPatrol: e.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 cursor-pointer">
            <span>{t.settings.mascotVoice}</span>
            <input
              type="checkbox"
              checked={settings.mascotVoice}
              onChange={(e) => updateSettings({ mascotVoice: e.target.checked })}
            />
          </label>
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <span>{t.settings.mascotSpeed}</span>
            <input
              type="range"
              min={0.5}
              max={1.8}
              step={0.1}
              value={settings.mascotSpeed}
              onChange={(e) => updateSettings({ mascotSpeed: Number(e.target.value) })}
              className="w-28"
            />
            <span className="font-mono tabular-nums text-xs">{settings.mascotSpeed.toFixed(1)}x</span>
          </div>
        </div>
      </section>

      {/* Creator Account & Authentication */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-base flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            <span>{t.settings.accountTitle}</span>
          </h3>
          {authUser && (
            <button
              type="button"
              onClick={() => setAuthSession(null, null)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out ({authUser.email})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-500 mb-1">{t.settings.displayName}</label>
            <input
              value={settings.userName}
              onChange={(e) => updateSettings({ userName: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-500 mb-1">{t.settings.roleLabel}</label>
            <input
              value={settings.userRole}
              onChange={(e) => updateSettings({ userRole: e.target.value })}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {!authUser && (
          <form
            onSubmit={handleAuthSubmit}
            className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAuthMode('login')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                  authMode === 'login' ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-slate-700'
                }`}
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthMode('register')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 ${
                  authMode === 'register' ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-slate-700'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Create Account</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="email@example.com"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <input
                type="password"
                required
                minLength={6}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password (min 6 chars)"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                disabled={authLoading}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {authLoading ? t.common.loading : authMode === 'register' ? 'Register & Sync' : 'Sign In & Sync'}
              </button>
            </div>
            {authError && <p className="text-xs text-rose-500">{authError}</p>}
          </form>
        )}
      </section>

      {/* Data, Privacy & History Management */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <h3 className="font-display font-semibold text-base flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500" />
          <span>{t.settings.privacyTitle}</span>
        </h3>

        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={settings.privacySaveHistory}
            onChange={(e) => updateSettings({ privacySaveHistory: e.target.checked })}
          />
          <span>{t.settings.saveHistory}</span>
        </label>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={exportBackup}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t.settings.exportBackup}</span>
          </button>

          <button
            type="button"
            onClick={clearAllConversations}
            className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t.settings.clearChats} ({conversations.length})</span>
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-3.5 py-2 rounded-lg border border-rose-500/40 text-xs font-medium inline-flex items-center gap-1.5 text-rose-500 hover:bg-rose-500/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.settings.resetAll}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await resetWorkspace();
                  setConfirmReset(false);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
              >
                {t.common.cancel}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Server AI Connection Health & Quotas (No API Key Inputs) */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-3">
        <h3 className="font-display font-semibold text-base flex items-center gap-2">
          <Server className="w-4 h-4 text-blue-500" />
          <span>{t.settings.apiTitle}</span>
        </h3>
        <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
          <p className="font-semibold">
            {serverHealth.geminiConfigured
              ? t.settings.apiConnected
              : t.settings.apiDisconnected}
          </p>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            {t.settings.apiExplain}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 mb-1">Standard / Free-Tier Ready</p>
              <ul className="space-y-1 text-slate-500 dark:text-slate-400">
                {(serverHealth.quotas?.freeTierReady || []).map((q) => (
                  <li key={q}>· {q}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">Paid Billing Required Models</p>
              <ul className="space-y-1 text-slate-500 dark:text-slate-400">
                {(serverHealth.quotas?.paidBillingRequired || []).map((q) => (
                  <li key={q}>· {q}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                {isNativePlatform() ? 'Android Native Backend Endpoint (HTTPS)' : 'Backend Service Endpoint (HTTPS)'}
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                {getActiveBackendUrl()}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                value={backendInput}
                onChange={(e) => setBackendInput(e.target.value)}
                placeholder={DEFAULT_BACKEND_URL}
                className="flex-1 min-w-[220px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const res = setCustomBackendUrl(backendInput);
                  if (!res.ok) {
                    setBackendStatus(res.error || 'Invalid URL');
                    return;
                  }
                  setBackendStatus('Backend endpoint updated.');
                  playUiSound('pop', settings.soundEnabled, settings.soundVolume);
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                {t.common.save}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomBackendUrl('');
                  setBackendInput(DEFAULT_BACKEND_URL);
                  setBackendStatus('Reset to default HTTPS backend.');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium"
              >
                {t.common.reset}
              </button>
            </div>
            {backendStatus && <p className="text-[11px] text-blue-500">{backendStatus}</p>}
          </div>
        </div>
      </section>

      {/* VIP AI Android Icon & Splash Screen Kit */}
      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display font-semibold text-base flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-500" />
            <span>VIP AI App Icon &amp; Splash Screen Kit</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <PWAInstallButton variant="card" />
            <button
              type="button"
              onClick={() => void triggerSplashPreview()}
              className="px-3 py-1.5 rounded-lg border border-blue-500/40 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isNativePlatform() ? 'Show Native SplashScreen' : 'Preview Splash Screen'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] p-4 flex items-center gap-4">
            <img
              src="/vip-ai-icon-512.png"
              alt="VIP AI App Icon"
              className="w-20 h-20 rounded-2xl border border-slate-700/60 shadow-lg shrink-0"
            />
            <div className="space-y-2 min-w-0">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">VIP AI App Icon</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Adaptive &amp; Play Store launcher assets (`com.vipservice.app`)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadAssetFile('/vip-ai-icon-1024.png', 'vip-ai-icon-1024.png')}
                  className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>1024px Icon</span>
                </button>
                <button
                  type="button"
                  onClick={() => void downloadAssetFile('/vip-ai-icon-512.png', 'vip-ai-icon-512.png')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>512px Icon</span>
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E14] p-4 flex items-center gap-4">
            <img
              src="/vip-ai-splash-logo.png"
              alt="VIP AI Custom Splash Logo"
              className="w-20 h-20 rounded-2xl border border-slate-700/60 shadow-lg shrink-0 object-cover"
            />
            <div className="space-y-2 min-w-0">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Custom Splash Screen Logo</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configured via `@capacitor/splash-screen` &amp; Android 13+ `Theme.SplashScreen`
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadAssetFile('/vip-ai-splash-logo.png', 'vip-ai-splash-logo.png')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Splash Logo</span>
                </button>
                <button
                  type="button"
                  onClick={() => void downloadAssetFile('/vip-ai-splash-screen.png', 'vip-ai-splash-screen.png')}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>1080×1920 Splash</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Download the complete icon &amp; splash kit ZIP (1024px, 512px Play Store icon, 432px adaptive foreground, splash logo &amp; HD splash).
          </p>
          <button
            type="button"
            disabled={packingKit}
            onClick={() => void downloadAndroidKitZip()}
            className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Package className="w-3.5 h-3.5" />
            <span>{packingKit ? 'Preparing Kit...' : 'Download Icon & Splash Kit (.zip)'}</span>
          </button>
        </div>
      </section>

      {previewingSplash && (
        <div
          onClick={() => setPreviewingSplash(false)}
          className="fixed inset-0 z-50 bg-[#101727] flex flex-col items-center justify-center p-6 cursor-pointer"
        >
          <img
            src="/vip-ai-splash-logo.png"
            alt="VIP AI Splash Screen Preview"
            className="w-72 h-72 sm:w-80 sm:h-80 object-contain rounded-3xl"
          />
          <p className="mt-4 text-xs text-slate-400">Tap anywhere to close SplashScreen preview</p>
        </div>
      )}
    </div>
  );
}
