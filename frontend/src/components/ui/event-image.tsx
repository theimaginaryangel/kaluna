"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1200&q=80",
];

function stableIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

export function fallbackEventImage(seed: string): string {
  return FALLBACK_IMAGES[stableIndex(seed || "kaluna", FALLBACK_IMAGES.length)];
}

interface EventImageProps {
  src?: string;
  seed: string;
  alt: string;
  className?: string;
}

export function EventImage({ src, seed, alt, className }: EventImageProps) {
  const resolved = src?.trim() || fallbackEventImage(seed);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [resolved]);

  if (failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-800 dark:to-slate-700">
        <span className="px-6 text-center text-xl font-semibold uppercase tracking-[0.3em] text-slate-700 dark:text-slate-200">
          {alt}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("absolute inset-0 h-full w-full object-cover", className)}
    />
  );
}
