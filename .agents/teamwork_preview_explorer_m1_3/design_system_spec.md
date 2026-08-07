# Kaluna Frontend Design System & Motion Specification

## Executive Summary & System Principles

The Kaluna design system is built for a modern, high-performance serverless ticketing platform. It pairs sleek dark-mode aesthetics with dynamic motion feedback.

A core principle of the Kaluna UI is **Dynamic Accent Focus**: the high-energy hot pink accent color (`#FF2D87`) is reserved exclusively for interactive and motion states. By preventing static overuse of the accent color, the UI maintains focus, high visual contrast, and delivers immediate visual feedback upon user interaction.

---

## 1. Tailwind CSS Theme Configuration

Below is the complete, drop-in configuration for `tailwind.config.js` (Tailwind CSS v3 / v4 compatible structure) and custom utility classes.

### 1.1 `tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Kaluna Accent - #FF2D87 Hot Pink (Interactive ONLY)
        kaluna: {
          pink: '#FF2D87',
          'pink-hover': '#FF4D9E',
          'pink-active': '#E01B72',
          'pink-glow': 'rgba(255, 45, 135, 0.35)',
          'pink-subtle': 'rgba(255, 45, 135, 0.12)',
          'pink-ripple': 'rgba(255, 45, 135, 0.25)',
        },
        // Dark Mode Base Palette
        dark: {
          bg: '#090A0F',
          surface: '#141622',
          elevated: '#1B1E2E',
          border: '#272B40',
          'border-muted': '#1F2233',
        },
        // Neutral Slate Scaling
        slate: {
          950: '#090A0F',
          900: '#141622',
          850: '#1B1E2E',
          800: '#272B40',
        },
      },
      transitionTimingFunction: {
        // Custom Easings
        'apple-spring': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'material-bouncy': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'shimmer-ease': 'linear',
      },
      transitionDuration: {
        '250': '250ms',
        '400': '400ms',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'ripple-expand': {
          '0%': { transform: 'scale(0)', opacity: '0.6' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
        'pulse-pink-glow': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(255, 45, 135, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(255, 45, 135, 0.6)' },
        },
        'bouncy-press': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.94)' },
          '100%': { transform: 'scale(1.02)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite linear',
        'ripple-expand': 'ripple-expand 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'pulse-pink': 'pulse-pink-glow 2s infinite ease-in-out',
        'bouncy-press': 'bouncy-press 300ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      boxShadow: {
        'pink-sm': '0 0 10px rgba(255, 45, 135, 0.25)',
        'pink-md': '0 0 20px rgba(255, 45, 135, 0.4)',
        'pink-lg': '0 0 35px rgba(255, 45, 135, 0.55)',
        'pink-inner': 'inset 0 0 12px rgba(255, 45, 135, 0.3)',
      },
    },
  },
  plugins: [],
};
```

### 1.2 Custom CSS Utilities (`globals.css`)

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer utilities {
  /* Strict Interactive Pink Utilities */
  .ring-pink-focus {
    @apply focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D87] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0F];
  }

  .hover-pink-border {
    @apply transition-colors duration-200 hover:border-[#FF2D87];
  }

  .hover-pink-text {
    @apply transition-colors duration-200 hover:text-[#FF2D87];
  }

  .hover-pink-glow {
    @apply transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(255,45,135,0.4)];
  }

  .active-pink-bg {
    @apply active:bg-[#FF2D87] active:text-white;
  }

  /* Hot Pink Loading Skeleton Utility */
  .skeleton-shimmer-pink {
    @apply relative overflow-hidden bg-slate-800/80 rounded-md;
  }

  .skeleton-shimmer-pink::after {
    content: '';
    @apply absolute inset-0 -translate-x-full animate-shimmer;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 45, 135, 0.05) 20%,
      rgba(255, 45, 135, 0.25) 50%,
      rgba(255, 45, 135, 0.05) 80%,
      transparent 100%
    );
  }
}
```

---

## 2. Accent Color Governance Rules (`#FF2D87` Hot Pink)

### 2.1 Governance Rationale
Color `#FF2D87` (Hot Pink) is Kaluna's signature motion accent. Uncontrolled use of hot pink on static backgrounds or text creates visual noise and degrades focus. Enforcing a strict separation between static elements and interactive signals maximizes UI reactivity.

### 2.2 Strict Rule Matrix

| UI Component Category | Static State Rule | Interactive / Motion State Rule | Approved Class Pattern |
| :--- | :--- | :--- | :--- |
| **Body / Paragraph Text** | ❌ FORBIDDEN (`#FF2D87`) | ✅ ALLOWED on `:hover` | `text-slate-300 hover:text-[#FF2D87]` |
| **Headings & Titles** | ❌ FORBIDDEN (`#FF2D87`) | ✅ ALLOWED on `:hover` | `text-white hover:text-[#FF2D87]` |
| **Card / Modal Backgrounds**| ❌ FORBIDDEN (`#FF2D87`) | ❌ Static fill forbidden; subtle hover tint allowed | `bg-[#141622] hover:border-[#FF2D87]` |
| **Primary Buttons** | ❌ Static solid pink forbidden | ✅ Pink on `:hover`, `:focus-visible`, `:active` | `bg-slate-800 hover:bg-[#FF2D87] active:bg-[#E01B72]` |
| **Focus Outlines / Rings** | N/A | ✅ MANDATORY on `:focus-visible` | `focus-visible:ring-2 focus-visible:ring-[#FF2D87]` |
| **Click / Tap Ripples** | N/A | ✅ MANDATORY for ripple effect wave | `bg-[#FF2D87]/30 animate-ripple-expand` |
| **Animated SVG Icons** | ❌ Static fill forbidden | ✅ Animated fill on hover/toggle state | `fill-slate-500 group-hover:fill-[#FF2D87]` |
| **Loading Skeletons** | ❌ Static pink blocks forbidden | ✅ Moving shimmer highlight overlay | `bg-gradient-to-r via-[#FF2D87]/25` |

### 2.3 Violation Examples vs. Corrected Code

#### Example A: Buttons
```tsx
// ❌ VIOLATION: Static pink background
<button className="bg-[#FF2D87] text-white px-4 py-2">
  Register Event
</button>

// ✅ CORRECT: Slate base with interactive Pink state & focus ring
<button className="bg-slate-800 text-slate-100 hover:bg-[#FF2D87] hover:shadow-[0_0_15px_rgba(255,45,135,0.4)] focus-visible:ring-2 focus-visible:ring-[#FF2D87] transition-all duration-200 rounded-lg px-4 py-2">
  Register Event
</button>
```

#### Example B: Cards & Containers
```tsx
// ❌ VIOLATION: Static pink border & text
<div className="border-[#FF2D87] text-[#FF2D87] p-6 bg-[#FF2D87]/10">
  Event Details
</div>

// ✅ CORRECT: Dark surface base, pink accent exclusively on hover border & icon hover
<div className="bg-[#141622] border border-[#272B40] hover:border-[#FF2D87] transition-all duration-300 p-6 rounded-xl group">
  <h3 className="text-slate-100 group-hover:text-[#FF2D87] transition-colors">Event Details</h3>
</div>
```

---

## 3. Motion Specifications & Framer Motion Variants

### 3.1 Apple-Style Spring Easing (`cubic-bezier(0.25, 0.1, 0.25, 1)`)

- **Purpose**: Smooth, refined transitions for page renders, modal entrances, drawer slide-ins, and layout reveals.
- **Timing Curve**: `cubic-bezier(0.25, 0.1, 0.25, 1)` (or Framer Motion Spring `{ stiffness: 300, damping: 30 }`).

#### Framer Motion Variants Code Snippet:
```typescript
import { Variants } from 'framer-motion';

export const APPLE_SPRING_EASE = [0.25, 0.1, 0.25, 1] as const;

// 1. Page Reveal / Route Transition
export const pageRevealVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: APPLE_SPRING_EASE,
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: {
      duration: 0.25,
      ease: APPLE_SPRING_EASE,
    },
  },
};

// 2. Staggered Container for Lists & Event Grids
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: APPLE_SPRING_EASE,
    },
  },
};

// 3. Modal / Drawer Slide-In
export const modalSpringVariants: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: APPLE_SPRING_EASE,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.2,
      ease: APPLE_SPRING_EASE,
    },
  },
};
```

---

### 3.2 Material-Style Bouncy Elevation (`cubic-bezier(0.34, 1.56, 0.64, 1)`)

- **Purpose**: Tactile, bouncy micro-interactions on button presses, interactive card hovering/elevation, badge pops, and ripple expansions.
- **Timing Curve**: `cubic-bezier(0.34, 1.56, 0.64, 1)` (overshooting elastic curve).

#### Framer Motion Variants Code Snippet:
```typescript
import { Variants } from 'framer-motion';

export const MATERIAL_BOUNCY_EASE = [0.34, 1.56, 0.64, 1] as const;

// 1. Interactive Button Press & Hover
export const buttonBouncyVariants: Variants = {
  initial: { scale: 1, y: 0 },
  hover: {
    scale: 1.03,
    y: -2,
    transition: {
      duration: 0.25,
      ease: MATERIAL_BOUNCY_EASE,
    },
  },
  tap: {
    scale: 0.94,
    y: 1,
    transition: {
      duration: 0.15,
      ease: MATERIAL_BOUNCY_EASE,
    },
  },
};

// 2. Interactive Ticket / Event Card Elevation
export const cardElevationVariants: Variants = {
  initial: {
    y: 0,
    scale: 1,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  hover: {
    y: -6,
    scale: 1.015,
    boxShadow: '0 12px 25px -5px rgba(255, 45, 135, 0.25)',
    transition: {
      duration: 0.3,
      ease: MATERIAL_BOUNCY_EASE,
    },
  },
  tap: {
    y: -2,
    scale: 0.99,
    transition: {
      duration: 0.15,
      ease: MATERIAL_BOUNCY_EASE,
    },
  },
};

// 3. Ripple Expansion Wave Variant
export const rippleVariants: Variants = {
  initial: {
    scale: 0,
    opacity: 0.7,
  },
  animate: {
    scale: 2.5,
    opacity: 0,
    transition: {
      duration: 0.6,
      ease: MATERIAL_BOUNCY_EASE,
    },
  },
};
```

---

### 3.3 Pink Shimmer Loading Skeletons (`#FF2D87`)

- **Purpose**: Skeleton placeholders during data fetching (events, ticket details, analytics) that feature a soft hot pink linear gradient sweep.
- **Color Structure**: `linear-gradient(90deg, transparent 0%, rgba(255, 45, 135, 0.25) 50%, transparent 100%)`.

#### Framer Motion & React Implementation Component:
```tsx
import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

export const PinkShimmerSkeleton: React.FC<SkeletonProps> = ({ className = 'h-6 w-full' }) => {
  return (
    <div className={`relative overflow-hidden bg-slate-800/80 rounded-lg ${className}`}>
      <motion.div
        className="absolute inset-0 w-full h-full"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255, 45, 135, 0.05) 20%, rgba(255, 45, 135, 0.28) 50%, rgba(255, 45, 135, 0.05) 80%, transparent 100%)',
        }}
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          repeat: Infinity,
          duration: 1.8,
          ease: 'linear',
        }}
      />
    </div>
  );
};
```

---

## 4. Complete Component Examples

### 4.1 Interactive Button with Pink Focus Ring & Material Bouncy Elevation

```tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { buttonBouncyVariants, rippleVariants } from './motion';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const KalunaButton: React.FC<ButtonProps> = ({ children, onClick, ...props }) => {
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples((prev) => [...prev, { x, y, id: Date.now() }]);

    if (onClick) onClick(e);
  };

  return (
    <motion.button
      variants={buttonBouncyVariants}
      initial="initial"
      whileHover="hover"
      whileTap="tap"
      onClick={handleClick}
      className="relative overflow-hidden px-6 py-3 rounded-xl bg-slate-800 text-slate-100 font-semibold border border-slate-700 hover:border-[#FF2D87] hover:text-white hover:shadow-[0_0_20px_rgba(255,45,135,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D87] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0F] transition-colors duration-200"
      {...props}
    >
      <span className="relative z-10">{children}</span>
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          variants={rippleVariants}
          initial="initial"
          animate="animate"
          onAnimationComplete={() => {
            setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
          }}
          className="absolute rounded-full bg-[#FF2D87]/30 pointer-events-none"
          style={{
            top: ripple.y - 25,
            left: ripple.x - 25,
            width: 50,
            height: 50,
          }}
        />
      ))}
    </motion.button>
  );
};
```

---

## 5. Verification & Checklist for Developers

1. **Tailwind Verification**:
   - Ensure custom colors (`kaluna.pink`), easings (`apple-spring`, `material-bouncy`), and keyframes are declared in `tailwind.config.js`.
2. **Color Governance Verification**:
   - Grep codebase for `#FF2D87` or `kaluna-pink` to confirm it only appears in `hover:`, `focus-visible:`, `active:`, keyframes, or ripple components.
3. **Motion Verification**:
   - Verify page reveals use Apple-style spring easing (`[0.25, 0.1, 0.25, 1]`).
   - Verify interactive buttons & cards use Material bouncy easing (`[0.34, 1.56, 0.64, 1]`).
   - Verify loading skeletons render hot pink shimmer gradient overlays (`rgba(255, 45, 135, 0.25)`).
