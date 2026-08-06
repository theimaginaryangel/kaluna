import * as React from 'react';
import { cn } from '@/lib/utils';
import { EventCategory, EventStatus } from '@/lib/types';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'outline' | 'tech' | 'books' | 'workshop' | 'available' | 'limited' | 'soldOut';
  interactive?: boolean;
}

export function Badge({
  className,
  variant = 'default',
  interactive = false,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider transition-all duration-200 border select-none';

  const variantStyles = {
    default: 'bg-slate-800/80 text-slate-200 border-slate-700',
    outline: 'bg-transparent text-slate-300 border-slate-700',
    // Category Variants
    tech: 'bg-cyan-950/70 text-cyan-300 border-cyan-800/60',
    books: 'bg-amber-950/70 text-amber-300 border-amber-800/60',
    workshop: 'bg-purple-950/70 text-purple-300 border-purple-800/60',
    // Status Variants
    available: 'bg-emerald-950/70 text-emerald-400 border-emerald-800/70',
    limited: 'bg-amber-950/70 text-amber-400 border-amber-800/70',
    soldOut: 'bg-rose-950/70 text-rose-400 border-rose-800/70',
  };

  const interactiveStyles =
    interactive ? 'cursor-pointer hover:border-[#FF2D87] hover:shadow-[0_0_12px_rgba(255,45,135,0.3)] hover:text-white' : '';

  return (
    <span
      className={cn(baseStyles, variantStyles[variant], interactiveStyles, className)}
      {...props}
    >
      {children}
    </span>
  );
}

export function CategoryBadge({
  category,
  className,
  interactive = false,
}: {
  category: EventCategory;
  className?: string;
  interactive?: boolean;
}) {
  const variantMap: Record<EventCategory, 'tech' | 'books' | 'workshop'> = {
    Tech: 'tech',
    Books: 'books',
    Workshop: 'workshop',
  };

  return (
    <Badge variant={variantMap[category]} interactive={interactive} className={className}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {category}
    </Badge>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: EventStatus | 'Available' | 'Limited' | 'Sold Out';
  className?: string;
}) {
  const isAvailable = status === 'Available';
  const isLimited = status === 'Limited';

  return (
    <Badge
      variant={isAvailable ? 'available' : isLimited ? 'limited' : 'soldOut'}
      className={cn('capitalize', className)}
    >
      <span
        className={cn(
          'mr-1.5 h-1.5 w-1.5 rounded-full',
          isAvailable && 'bg-emerald-400 animate-pulse',
          isLimited && 'bg-amber-400 animate-ping',
          !isAvailable && !isLimited && 'bg-rose-400'
        )}
      />
      {status}
    </Badge>
  );
}
