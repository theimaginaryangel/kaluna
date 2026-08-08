'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ButterflyBurstProps {
  active: boolean;
  count?: number;
}

// Offsets are relative to the LEFT edge of the text, so butterflies hover
// beside the dedication rather than on top of it.
const OFFSETS = [
  { x: -18, y: -22 },
  { x: -36, y: -6 },
  { x: -12, y: 12 },
  { x: -30, y: 16 },
];

function FlutteringButterfly({ size = 18, phase = 0 }: { size?: number; phase?: number }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="text-[#FF2D87]"
      style={{ overflow: 'visible' }}
      animate={{ y: [0, -3.5, 0], rotate: [0, 7, -3, 0] }}
      transition={{ duration: 1.7, repeat: Infinity, ease: 'easeInOut', delay: -phase }}
    >
      <g fill="currentColor">
        {/* Left wings — fold toward the body when flapping */}
        <motion.g
          style={{ transformOrigin: '12px 12px' }}
          animate={{ scaleX: [1, 0.16, 1] }}
          transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut', delay: -phase }}
        >
          <ellipse cx="7.2" cy="8.6" rx="6.2" ry="4.6" transform="rotate(-24 7.2 8.6)" />
          <ellipse cx="8.4" cy="15.6" rx="3.8" ry="3.1" transform="rotate(34 8.4 15.6)" />
        </motion.g>
        {/* Right wings */}
        <motion.g
          style={{ transformOrigin: '12px 12px' }}
          animate={{ scaleX: [1, 0.16, 1] }}
          transition={{ duration: 0.32, repeat: Infinity, ease: 'easeInOut', delay: -phase }}
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
                left: '0%',
                top: '50%',
                transform: `translate(${offset.x}px, calc(-50% + ${offset.y}px))`,
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.25, delay: i * 0.07, ease: 'easeOut' }}
            >
              <FlutteringButterfly size={i % 2 === 0 ? 18 : 14} phase={i * 0.14} />
            </motion.span>
          ))}
      </AnimatePresence>
    </span>
  );
}
