'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { href: '/', label: 'Explore' },
    { href: '/events', label: 'Events' },
    { href: '/checkin', label: 'Check-In' },
    { href: '/admin', label: 'Admin' },
  ];

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#1C1C1E]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/">
          <motion.div
            className="relative flex items-center gap-2 group ring-pink-focus rounded-md p-1"
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400, damping: 10 }}
          >
            <span className="font-mono text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              KALUNA
            </span>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              EVENTS
            </span>
            <motion.span
              className="absolute bottom-0 left-0 h-0.5 bg-[#FF2D87] rounded-full"
              initial={{ width: 0, opacity: 0 }}
              whileHover={{ width: '100%', opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            />
          </motion.div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'relative px-3.5 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 transition-all duration-200 flex items-center gap-2',
                  'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-[#FF2D87]/40 border border-transparent',
                  'ring-pink-focus uppercase tracking-wider text-xs',
                  isActive && 'text-slate-900 dark:text-white font-extrabold bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                )}
              >
                <span>{link.label}</span>
                {isActive && (
                  <motion.span
                    layoutId="activeNavIndicator"
                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#FF2D87] rounded-full"
                    transition={{ duration: 0.3, ease: appleSpringEase }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop CTA & Theme Toggle */}
        <div className="hidden md:flex items-center gap-3">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ring-pink-focus"
              aria-label="Toggle Dark Mode"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
          
          <Link href="/events">
            <Button variant="primary" size="sm" className="font-bold uppercase tracking-wider text-xs bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
              Browse Catalog
            </Button>
          </Link>
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="md:hidden flex items-center gap-2">
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ring-pink-focus"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors ring-pink-focus"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: appleSpringEase }}
            className="md:hidden overflow-hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1C1C1E]"
          >
            <div className="px-4 pt-3 pb-6 space-y-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-200 transition-all',
                      'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white hover:border-[#FF2D87]/40 border border-transparent',
                      isActive && 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold border-slate-200 dark:border-slate-700'
                    )}
                  >
                    <span>{link.label}</span>
                  </Link>
                );
              })}

              <div className="pt-4 border-t border-slate-200 dark:border-[#272B40]">
                <Link href="/events" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="lg" className="w-full justify-center font-bold uppercase tracking-wider bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
                    Browse All Events
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
