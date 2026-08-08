'use client';

import * as React from 'react';
import Link from 'next/link';

export function WordmarkLink() {
  const [hovered, setHovered] = React.useState(false);
  return (
    <Link
      href="/"
      className="relative inline-flex items-center gap-2 w-fit ring-pink-focus rounded-md p-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        className="font-mono text-xl font-extrabold tracking-tight transition-colors duration-150"
        style={{ color: hovered ? '#FF2D87' : undefined }}
      >
        KALUNA
      </span>
      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
        EVENTS
      </span>
    </Link>
  );
}
