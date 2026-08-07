'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getCreatorEmail, isCreatorMode } from '@/lib/api';
import { ShieldCheck, Sparkles, ArrowRight } from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [resolved, setResolved] = React.useState(false);

  React.useEffect(() => {
    const hasToken =
      typeof window !== 'undefined' && Boolean(window.localStorage.getItem('kaluna_jwt_token'));
    if (hasToken || isCreatorMode()) {
      router.replace('/admin/dashboard');
      return;
    }
    setResolved(true);
  }, [router]);

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  if (!resolved) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-[#FF2D87] animate-spin" />
      </div>
    );
  }

  const existingEmail = getCreatorEmail();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 flex items-center justify-center px-4 py-20">
      <div className="max-w-2xl w-full space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: appleSpringEase }}
          className="text-center space-y-2"
        >
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Kaluna Console
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Choose how you want to manage events.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05, ease: appleSpringEase }}
          >
            <Link href="/admin/creator-login" className="block h-full">
              <div className="h-full p-6 rounded-3xl bg-white dark:bg-[#141622] border border-slate-200 dark:border-slate-800 shadow-soft hover:border-[#FF2D87]/50 hover:shadow-soft-lg transition-all space-y-4 group">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#FF2D87]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Creator Console</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Password-less. Sign in with your email to create and manage your own events,
                    registrations, and check-ins.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#FF2D87]">
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: appleSpringEase }}
          >
            <Link href="/admin/login" className="block h-full">
              <div className="h-full p-6 rounded-3xl bg-white dark:bg-[#141622] border border-slate-200 dark:border-slate-800 shadow-soft hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-soft-lg transition-all space-y-4 group">
                <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Admin Login</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Godmode access. Sign in with your Cognito credentials for platform-wide
                    analytics and full control.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {existingEmail && (
          <div className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Signed in as{' '}
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{existingEmail}</span>
              {' — '}
              <Link href="/admin/dashboard" className="font-bold text-[#FF2D87] hover:underline">
                open console
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
