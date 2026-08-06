import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarStackProps {
  count?: number;
  className?: string;
}

export function AvatarStack({ count = 3, className }: AvatarStackProps) {
  // Generate random seed array based on count
  const seeds = React.useMemo(
    () => Array.from({ length: count }, (_, i) => `seed-${Math.random().toString(36).substring(7)}-${i}`),
    [count]
  );
  
  // Random extra count
  const extra = React.useMemo(() => Math.floor(Math.random() * 50) + 10, []);

  return (
    <div className={cn('flex items-center', className)}>
      <div className="flex -space-x-3 overflow-hidden">
        {seeds.map((seed, i) => (
          <img
            key={i}
            className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-[#1C1C1E] bg-slate-100 dark:bg-slate-800"
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
            alt="Avatar"
          />
        ))}
      </div>
      <div className="ml-3 text-xs font-medium text-slate-500 dark:text-slate-400">
        +{extra} going
      </div>
    </div>
  );
}
