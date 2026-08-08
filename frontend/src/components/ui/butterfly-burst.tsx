'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ButterflyBurstProps {
  active: boolean;
  count?: number;
}

// Positioned in % of the text's own width/height.
// x: negative = how far left of the text's left edge (0 = at the first letter).
// y: 0 = top, 50 = middle, 100 = bottom of the text line.
const OFFSETS = [
  { x: -28, y: 32 },
  { x: -46, y: 55 },
  { x: -20, y: 80 },
];

const SIZES = [18, 15, 13];

function FlutteringButterfly({ size = 18, phase = 0 }: { size?: number; phase?: number }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="text-[#FF2D87]"
      style={{ overflow: 'visible' }}
    >
      <g fill="currentColor">
        {/* Left wings — fold toward the body when flapping */}
        <motion.g
          style={{ transformOrigin: '12px 12px' }}
          animate={{ scaleX: [1, 0.2, 1] }}
          transition={{ duration: 0.45, repeat: Infinity, ease: 'easeInOut', delay: -phase }}
        >
          <ellipse cx="7.2" cy="8.6" rx="6.2" ry="4.6" transform="rotate(-24 7.2 8.6)" />
          <ellipse cx="8.4" cy="15.6" rx="3.8" ry="3.1" transform="rotate(34 8.4 15.6)" />
        </motion.g>
        {/* Right wings */}
        <motion.g
          style={{ transformOrigin: '12px 12px' }}
          animate={{ scaleX: [1, 0.2, 1] }}
          transition={{ duration: 0.45, repeat: Infinity, ease: 'easeInOut', delay: -phase }}
        >
          <ellipse cx="16.8" cy="8.6" rx="6.2" ry="4.6" transform="rotate(24 16.8 8.6)" />
          <ellipse cx="15.6" cy="15.6" rx="3.8" ry="3.1" transform="rotate(-34 15.6 15.6)" />
        </motion.g>
        {/* Body */}
        <ellipse cx="12" cy="12" rx="1.15" ry="7.2" />
      </g>
      {/* Antennae */}
      <g stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round">
        <path d="M12 4.8 C 12 3.2, 11 2.4, 9.8 2.2" />
        <path d="M12 4.8 C 12 3.2, 13 2.4, 14.2 2.2" />
      </g>
      <circle cx="9.6" cy="2.1" r="0.5" fill="currentColor" />
      <circle cx="14.4" cy="2.1" r="0.5" fill="currentColor" />
    </motion.svg>
  );
}

export function ButterflyBurst({ active, count = 3 }: ButterflyBurstProps) {
  const butterflies = OFFSETS.slice(0, Math.min(count, OFFSETS.length));

  return (
    <span className="absolute inset-0 pointer-events-none" aria-hidden>
      <AnimatePresence>
        {active &&
          butterflies.map((offset, i) => (
            <motion.span
              key={i}
              className="absolute"
              style={{ left: `${offset.x}%`, top: `${offset.y}%` }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.3, delay: i * 0.08, ease: 'easeOut' }}
            >
              {/* Drifting loop flight path, de-phased per butterfly */}
              <motion.span
                className="block"
                style={{ filter: 'drop-shadow(0 0 4px rgba(255,45,135,0.35))' }}
                animate={{ x: [0, 7, -5, 0], y: [0, -6, -3, 0], rotate: [0, 9, -7, 0] }}
                transition={{
                  duration: 3.2 + i * 0.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: -i * 0.4,
                }}
              >
                <FlutteringButterfly size={SIZES[i]} phase={i * 0.35} />
              </motion.span>
            </motion.span>
          ))}
      </AnimatePresence>
    </span>
  );
}
