'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, 'children'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  children?: React.ReactNode;
}

interface Ripple {
  x: number;
  y: number;
  id: number;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      onClick,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const handlePointerDown = (e: React.MouseEvent<HTMLButtonElement>) => {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newRipple = { x, y, id: Date.now() };

      setRipples((prev) => [...prev.slice(-4), newRipple]);
    };

    const variantStyles = {
      primary:
        'bg-slate-900 text-white border border-transparent shadow-soft hover:bg-slate-800 hover:border-[#FF2D87]/40 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:hover:border-[#FF2D87]/40',
      secondary:
        'bg-slate-100 text-slate-900 border border-slate-200 hover:bg-slate-200 hover:border-[#FF2D87]/40 dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:hover:bg-slate-700',
      outline:
        'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-[#FF2D87] hover:text-[#FF2D87] dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-800/50 dark:hover:border-[#FF2D87] dark:hover:text-[#FF2D87]',
      ghost:
        'bg-transparent text-slate-700 border border-transparent hover:bg-slate-100 hover:text-[#FF2D87] dark:text-slate-300 dark:hover:bg-slate-800/50 dark:hover:text-[#FF2D87]',
      white:
        'bg-white text-slate-950 font-semibold border border-slate-200 shadow-soft hover:bg-slate-50 hover:border-[#FF2D87]',
    };

    const sizeStyles = {
      sm: 'px-4 py-2 text-xs rounded-full font-bold tracking-wide',
      md: 'px-5 py-2.5 text-sm rounded-full font-bold tracking-wide',
      lg: 'px-8 py-3.5 text-base rounded-full font-bold tracking-wide',
      icon: 'p-2.5 rounded-full flex items-center justify-center',
    };

    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.03, boxShadow: '0px 0px 18px rgba(255, 45, 135, 0.35)' }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.96 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        onClick={(e) => {
          handlePointerDown(e);
          onClick?.(e);
        }}
        className={cn(
          'relative overflow-hidden inline-flex items-center justify-center select-none outline-none cursor-pointer',
          'ring-pink-focus',
          variantStyles[variant],
          sizeStyles[size],
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed pointer-events-none',
          className
        )}
        {...props}
      >
        {/* Animated Loading Spinner */}
        {isLoading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}

        <span className="relative z-10 flex items-center gap-2">{children}</span>

        {/* Dynamic Interactive Pink Ripple Container */}
        <span className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-[inherit]">
          {ripples.map((ripple) => (
            <span
              key={ripple.id}
              className="absolute bg-[#FF2D87]/40 rounded-full animate-ripple-expand -translate-x-1/2 -translate-y-1/2"
              style={{
                left: ripple.x,
                top: ripple.y,
                width: 120,
                height: 120,
              }}
              onAnimationEnd={() => {
                setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
              }}
            />
          ))}
        </span>
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
