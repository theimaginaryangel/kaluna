import * as React from 'react';
import Link from 'next/link';
import { Sparkles, Github, Twitter, Globe, Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full bg-[#090A0F] border-t border-[#272B40] text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
          {/* Brand Col */}
          <div className="space-y-4 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center group-hover:border-[#FF2D87] transition-colors">
                <Sparkles className="w-3.5 h-3.5 text-white group-hover:text-[#FF2D87] transition-colors" />
              </div>
              <span className="font-mono text-lg font-bold tracking-tight text-white">
                KALUNA
              </span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Curated technical workshops, literary salons, and speculative discourse. Built with editorial precision.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <a
                href="#"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-[#FF2D87]/50 transition-all duration-200 ring-pink-focus"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-[#FF2D87]/50 transition-all duration-200 ring-pink-focus"
                aria-label="Twitter"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#"
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

          {/* System Info Col */}
          <div className="space-y-3">
            <h4 className="font-mono text-xs uppercase tracking-widest text-slate-200 font-bold">
              System Specification
            </h4>
            <p className="text-xs text-slate-400">
              Kaluna Event Platform v1.0. High-performance Next.js 14 design system with bouncy interactions and spring motion tokens.
            </p>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-[#272B40]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Kaluna Platform. All rights reserved.</p>
          <p className="flex items-center gap-1">
            <span>Crafted with</span>
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            <span>for event creators</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
