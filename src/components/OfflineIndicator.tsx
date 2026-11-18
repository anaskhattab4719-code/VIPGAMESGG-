import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useVip } from '../context/VipContext';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { settings } = useVip();

  if (isOnline) return null;

  const isAr = settings.language === 'ar';

  return (
    <div
      role="status"
      className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        {isAr
          ? 'وضع عدم الاتصال — يتم استخدام البيانات المخزنة مؤقتاً.'
          : 'Offline Mode — Cached workspace assets active.'}
      </span>
    </div>
  );
};
