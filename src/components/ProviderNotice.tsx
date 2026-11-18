import React from 'react';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import { useVip } from '../context/VipContext';

interface ProviderNoticeProps {
  error?: string | null;
  code?: string | null;
  onRetry?: () => void;
}

export function ProviderNotice({ error, code, onRetry }: ProviderNoticeProps) {
  const { t } = useVip();
  if (!error) return null;

  const isPaidGate = code === 'PAID_KEY_REQUIRED' || code === 'QUOTA_EXCEEDED';

  return (
    <div
      role="alert"
      className={`rounded-xl border p-4 text-sm ${
        isPaidGate
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
          : 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200'
      }`}
    >
      <div className="flex items-start gap-3">
        {isPaidGate ? (
          <Info className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="font-semibold">
            {isPaidGate ? t.common.paidKeyTitle : error}
          </p>
          <p className="text-xs opacity-90 leading-relaxed">
            {isPaidGate ? t.common.paidKeyDesc : error}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-opacity"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t.common.retry}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
