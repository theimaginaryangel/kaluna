import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular' | 'card';
}

export function Skeleton({ className, variant = 'rectangular', ...props }: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    rectangular: 'h-24 w-full rounded-lg',
    circular: 'h-12 w-12 rounded-full',
    card: 'h-64 w-full rounded-xl',
  };

  return (
    <div
      className={cn(
        'skeleton-shimmer-pink',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export function PinkShimmerSkeleton({ className, variant = 'rectangular', ...props }: SkeletonProps) {
  return <Skeleton className={className} variant={variant} {...props} />;
}

export function EventCardSkeleton() {
  return (
    <div className="bg-[#141622] border border-[#272B40] rounded-2xl overflow-hidden p-5 flex flex-col gap-4">
      <Skeleton variant="rectangular" className="h-48 rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-24 h-6 rounded-md" />
        <Skeleton variant="text" className="w-16 h-5 rounded-md" />
      </div>
      <Skeleton variant="text" className="w-3/4 h-7 rounded-md" />
      <Skeleton variant="text" className="w-full h-4 rounded-md" />
      <Skeleton variant="text" className="w-5/6 h-4 rounded-md" />
      <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" className="h-9 w-9" />
          <Skeleton variant="text" className="w-28 h-4 rounded-md" />
        </div>
        <Skeleton variant="text" className="w-24 h-9 rounded-lg" />
      </div>
    </div>
  );
}

