'use client';

import * as React from 'react';
import Link from 'next/link';
import { SparkleBurst } from '@/components/ui/sparkle-burst';

export function WordmarkLink() {
  const [hovered, setHovered] = React.useState(false);
  return (
    <Link
      href="/"
      className="relative inline-flex items-center gap-2 w-fit"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="relative">
        <span className="font-mono text-lg font-bold tracking-tight text-white">KALUNA</span>
        <SparkleBurst active={hovered} count={3} />
      </span>
    </Link>
  );
}
