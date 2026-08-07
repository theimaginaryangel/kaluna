'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface AvatarStackProps {
  registeredCount?: number;
  className?: string;
}

export function AvatarStack({ registeredCount = 0, className }: AvatarStackProps) {
  const visibleCount = Math.min(5, registeredCount);
  const seeds = Array.from({ length: visibleCount }, (_, i) => `kaluna-attendee-${i}`);

  if (registeredCount === 0) return null;

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
        {registeredCount} going
      </div>
    </div>
  );
}
