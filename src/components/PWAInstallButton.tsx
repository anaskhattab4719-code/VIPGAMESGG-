import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useVip } from '../context/VipContext';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'card' }> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, isNative, install } = usePWAInstall();
  const { settings } = useVip();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled || isNative) {
    return null;
  }

  const isAr = settings.language === 'ar';

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuide(true);
      }
      return;
    }
    setShowGuide(true);
  };

  const buttonLabel = isAr ? 'تثبيت VIP AI' : 'Install App';

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        className={
          variant === 'card'
            ? 'inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-600/15 hover:bg-blue-600/25 px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 transition-colors whitespace-nowrap shrink-0'
        }
        title={isAr ? 'تثبيت VIP AI كتطبيق مستقل' : 'Install VIP AI as a standalone app'}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{buttonLabel}</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131722] p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="VIP AI"
                  className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    {isAr ? 'تثبيت تطبيق VIP AI' : 'Install VIP AI App'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isAr
                      ? 'تشغيل مستقل بدون شريط المتصفح'
                      : 'Standalone app without browser bars'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  {isAr
                    ? 'اضغط على زر المشاركة (Share) في شريط Safari.'
                    : 'Tap the Share button in the Safari toolbar.'}
                </li>
                <li>
                  {isAr
                    ? 'مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                    : 'Scroll down and tap "Add to Home Screen".'}
                </li>
              </ol>
            ) : (
              <div className="space-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                <p className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                  <Smartphone className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>
                    {isAr ? 'التثبيت عبر Chrome على أندرويد أو سطح المكتب:' : 'Install via Chrome on Android or Desktop:'}
                  </span>
                </p>
                <ol className="space-y-1.5 list-decimal list-inside">
                  <li>
                    {isAr
                      ? 'افتح قائمة المتصفح (⋮) في أعلى Chrome.'
                      : 'Tap the browser menu (⋮) in Chrome.'}
                  </li>
                  <li>
                    {isAr
                      ? 'اختر "تثبيت التطبيق" (Install app) أو "إضافة إلى الشاشة الرئيسية".'
                      : 'Tap "Install app" or "Add to Home screen".'}
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 py-2 text-xs font-semibold text-white transition-colors"
            >
              {isAr ? 'فهمت' : 'Got it'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
