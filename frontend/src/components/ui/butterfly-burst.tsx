'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ButterflyBurstProps {
  active: boolean;
  count?: number;
}

// One lazy oval orbit, sampled every 45° and closed back to start.
// Centered on the overlay area (the brand column), so the butterfly
// drifts slowly around the dedication space instead of hovering.
const OVAL_X = [170, 120, 0, -120, -170, -120, 0, 120, 170];
const OVAL_Y = [0, 52, 74, 52, 0, -52, -74, -52, 0];
const OVAL_DURATION = 10;

// Tiny sparkles that trail the butterfly. Offsets are relative to the
// butterfly body; each twinkles in and out on its own phase.
const SPARKLE_OFFSETS = [
  { x: -7, y: 3, size: 4, delay: 0.15 },
  { x: -13, y: -4, size: 3, delay: 0.55 },
  { x: -19, y: 1, size: 3.5, delay: 0.95 },
];

function Sparkle({ size, delay }: { size: number; delay: number }) {
  return (
    <motion.svg
      viewBox="0 0 8 8"
      width={size}
      height={size}
      className="text-[#FFD6E8] absolute"
      style={{ overflow: 'visible' }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1, 0.4] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <path
        d="M4 0 L4.7 3.3 L8 4 L4.7 4.7 L4 8 L3.3 4.7 L0 4 L3.3 3.3 Z"
        fill="currentColor"
      />
    </motion.svg>
  );
}

function FlutteringButterfly({ size = 26 }: { size?: number }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="text-[#FF2D87]"
      style={{ overflow: 'visible', filter: 'drop-shadow(0 0 5px rgba(255,45,135,0.45))' }}
    >
      <g fill="currentColor">
        {/* Left wings — fold toward the body when flapping */}
        <motion.g
          style={{ transformOrigin: '12px 12px' }}
          animate={{ scaleX: [1, 0.25, 1] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ellipse cx="7.2" cy="8.6" rx="6.2" ry="4.6" transform="rotate(-24 7.2 8.6)" />
          <ellipse cx="8.4" cy="15.6" rx="3.8" ry="3.1" transform="rotate(34 8.4 15.6)" />
        </motion.g>
        {/* Right wings */}
        <motion.g
          style={{ transformOrigin: '12px 12px' }}
          animate={{ scaleX: [1, 0.25, 1] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut', delay: 0.05 }}
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

export function ButterflyBurst({ active, count = 1 }: ButterflyBurstProps) {
  void count;
  return (
    <span className="absolute inset-0 pointer-events-none" aria-hidden>
      <AnimatePresence>
        {active && (
          <motion.span
            className="absolute"
            style={{ left: '50%', top: '50%' }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Lazy oval flight path */}
            <motion.span
              className="block"
              animate={{ x: OVAL_X, y: OVAL_Y, rotate: [0, 14, -10, 0] }}
              transition={{
                x: { duration: OVAL_DURATION, repeat: Infinity, ease: 'easeInOut', delay: -3 },
                y: { duration: OVAL_DURATION, repeat: Infinity, ease: 'easeInOut', delay: -3 },
                rotate: { duration: OVAL_DURATION, repeat: Infinity, ease: 'easeInOut', delay: -3 },
              }}
            >
              {/* Sparkle trail — moves with the butterfly, twinkles on its own rhythm */}
              {SPARKLE_OFFSETS.map((s, i) => (
                <span
                  key={i}
                  className="absolute"
                  style={{ left: `${s.x}px`, top: `${s.y}px`, marginTop: `${s.size / 2}px` }}
                >
                  <Sparkle size={s.size} delay={s.delay} />
                </span>
              ))}
              <FlutteringButterfly />
            </motion.span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
