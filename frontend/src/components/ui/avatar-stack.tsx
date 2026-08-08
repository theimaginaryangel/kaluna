'use client';

import * as React from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarStackProps {
  registeredCount?: number;
  className?: string;
}

export function AvatarStack({ registeredCount = 0, className }: AvatarStackProps) {
  if (registeredCount === 0) return null;

  return (
    <div className={cn('flex items-center', className)}>
      <Users className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" aria-hidden />
      <div className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {registeredCount} going
      </div>
    </div>
  );
}
