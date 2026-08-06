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
