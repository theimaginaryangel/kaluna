'use client';

import * as React from 'react';
import Link from 'next/link';
import { Github, Linkedin, Globe } from 'lucide-react';
import { WordmarkLink } from '@/components/layout/wordmark-link';
import { SparkleBurst } from '@/components/ui/sparkle-burst';

export function Footer() {
  const [dedicationHovered, setDedicationHovered] = React.useState(false);
  return (
    <footer className="w-full bg-[#090A0F] border-t border-[#272B40] text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <WordmarkLink />
            <p
              className="relative w-fit text-xs text-slate-400 leading-relaxed transition-colors duration-200 hover:text-[#FF2D87]"
              onMouseEnter={() => setDedicationHovered(true)}
              onMouseLeave={() => setDedicationHovered(false)}
            >
              For Karen, moonlight.
              <span className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
                <SparkleBurst active={dedicationHovered} count={3} />
              </span>
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="https://github.com/theimaginaryangel/kaluna"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-[#FF2D87]/50 transition-all duration-200 ring-pink-focus"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://www.linkedin.com/in/bennyduah"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-[#FF2D87]/50 transition-all duration-200 ring-pink-focus"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://bennyduah.com"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-[#FF2D87]/50 transition-all duration-200 ring-pink-focus"
                aria-label="Website"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Categories Col */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-widest text-slate-200 font-bold">
              Categories
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link
                  href="/events?category=Tech"
                  className="hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Tech & Artificial Intelligence
                </Link>
              </li>
              <li>
                <Link
                  href="/events?category=Books"
                  className="hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Books & Literary Salons
                </Link>
              </li>
              <li>
                <Link
                  href="/events?category=Workshop"
                  className="hover:text-white hover:translate-x-1 transition-all inline-block"
                >
                  Hands-on Engineering Workshops
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform Col */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-widest text-slate-200 font-bold">
              Platform
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/events" className="hover:text-white transition-colors">
                  All Events
                </Link>
              </li>
              <li>
                <Link href="/checkin" className="hover:text-white transition-colors">
                  Ticket Scanner & Check-In
                </Link>
              </li>
              <li>
                <Link href="/admin" className="hover:text-white transition-colors">
                  Admin Analytics Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-[#272B40]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Kaluna Platform. All rights reserved.</p>
          <p className="flex items-center gap-1">
            <span>Project by</span>
            <a
              href="https://bennyduah.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              Benny Duah
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
