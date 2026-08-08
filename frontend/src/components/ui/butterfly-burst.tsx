'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ButterflyBurstProps {
  active: boolean;
  count?: number;
}

const OFFSETS = [
  { x: -22, y: -20 },
  { x: 20, y: -16 },
  { x: -14, y: 16 },
  { x: 22, y: 14 },
];

const LEFT_WINGS = [
  'M2.77 9.78a3 3 0 0 0-2.53 4.6A2.86 2.86 0 0 0 2.66 14a3 3 0 0 0 .66-4.22',
  'M5.3 4.4a4 4 0 0 1 6.7 1.4',
  'M8.9 12.1c-3 .3-5.1 1.3-5.1 3.9 0 .9.9 2 1.7 3.5',
];

const RIGHT_WINGS = [
  'M21.23 9.78a3 3 0 0 1 2.53 4.6A2.86 2.86 0 0 1 21.34 14a3 3 0 0 1-.66-4.22Z',
  'M18.7 4.4a4 4 0 0 0-6.7 1.4',
  'M15.1 12.1c3 .3 5.1 1.3 5.1 3.9 0 .9-.9 2-1.7 3.5',
];

function FlutteringButterfly({ size = 16 }: { size?: number }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[#FF2D87]"
      style={{ overflow: 'visible' }}
      animate={{ y: [0, -3, 0], rotate: [0, 6, 0] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Body */}
      <path d="M12 5.8v14.7" />
      {/* Left wings — flap around the body axis */}
      <motion.g
        style={{ transformOrigin: '12px 12px' }}
        animate={{ scaleX: [1, 0.18, 1] }}
        transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut' }}
      >
        {LEFT_WINGS.map((d, i) => (
          <path key={`l${i}`} d={d} />
        ))}
      </motion.g>
      {/* Right wings — flap around the body axis */}
      <motion.g
        style={{ transformOrigin: '12px 12px' }}
        animate={{ scaleX: [1, 0.18, 1] }}
        transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut' }}
      >
        {RIGHT_WINGS.map((d, i) => (
          <path key={`r${i}`} d={d} />
        ))}
      </motion.g>
    </motion.svg>
  );
}

export function ButterflyBurst({ active, count = 3 }: ButterflyBurstProps) {
  const butterflies = OFFSETS.slice(0, Math.min(count, 4));

  return (
    <span className="absolute inset-0 pointer-events-none" aria-hidden>
      <AnimatePresence>
        {active &&
          butterflies.map((offset, i) => (
            <motion.span
              key={i}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.25, delay: i * 0.07, ease: 'easeOut' }}
            >
              <FlutteringButterfly size={i % 2 === 0 ? 16 : 13} />
            </motion.span>
          ))}
      </AnimatePresence>
    </span>
  );
}
