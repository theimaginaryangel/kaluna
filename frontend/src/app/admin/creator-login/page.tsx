'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { setCreatorEmail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserRound, Mail, AlertCircle, ArrowLeft } from 'lucide-react';

export default function CreatorLoginPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [emailError, setEmailError] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError('');

    const value = email.trim().toLowerCase();
    if (!value) {
      setEmailError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError('Enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setCreatorEmail(value);
    router.push('/admin/dashboard');
  };

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 flex items-center justify-center px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: appleSpringEase }}
        className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-[#141622] border border-slate-200 dark:border-slate-800 shadow-soft space-y-6 relative overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#FF2D87]/20 blur-[60px] rounded-full pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center mx-auto text-slate-900 dark:text-white shadow-inner">
            <UserRound className="w-6 h-6 text-[#FF2D87]" />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight pt-2">
            Creator Console
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No password needed. Sign in with your email to manage your own events.
          </p>
        </div>

        {/* Info Banner */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
            <Mail className="w-4 h-4 text-[#FF2D87] shrink-0" />
            <span>Password-less access</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
            You will only see events created under this email. Registration and check-in data stay scoped to your events.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Creator Email"
            type="email"
            placeholder="creator@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            icon={<Mail className="w-4 h-4" />}
            disabled={isSubmitting}
            autoFocus
          />

          <div className="pt-2">
            <Button
              type="submit"
              variant="white"
              size="lg"
              isLoading={isSubmitting}
              className="w-full justify-center font-bold"
            >
              Open My Console
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors ring-pink-focus rounded px-2 py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Console</span>
          </Link>
          <p className="text-[11px] text-slate-500 dark:text-slate-500 font-mono">
            No sign-up required.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
