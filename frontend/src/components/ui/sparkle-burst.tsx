'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkle } from 'lucide-react';

interface SparkleBurstProps {
  active: boolean;
  count?: number;
}

const OFFSETS = [
  { x: -14, y: -14 },
  { x: 14, y: -10 },
  { x: -8, y: 12 },
  { x: 16, y: 10 },
];

export function SparkleBurst({ active, count = 3 }: SparkleBurstProps) {
  const particles = OFFSETS.slice(0, Math.min(count, 4));

  return (
    <span className="absolute inset-0 pointer-events-none" aria-hidden>
      <AnimatePresence>
        {active &&
          particles.map((offset, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.18, delay: i * 0.055, ease: 'easeOut' }}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
            >
              <Sparkle className="w-2 h-2 text-[#FF2D87] fill-[#FF2D87]" />
            </motion.span>
          ))}
      </AnimatePresence>
    </span>
  );
}
