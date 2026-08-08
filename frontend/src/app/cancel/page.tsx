'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api, KalunaApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PinkShimmerSkeleton } from '@/components/ui/skeleton';
import { AlertCircle, ArrowLeft, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';

type CancelState = 'idle' | 'confirming' | 'submitting' | 'cancelled' | 'error';

function CancelContent() {
  const searchParams = useSearchParams();
  const initialCode = (searchParams?.get('code') || '').trim();

  const [ticketCode, setTicketCode] = React.useState(initialCode);
  const [state, setState] = React.useState<CancelState>(initialCode ? 'confirming' : 'idle');
  const [message, setMessage] = React.useState('');
  const isSubmitting = state === 'submitting';

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = ticketCode.trim();
    if (!code) {
      setState('error');
      setMessage('Please enter the pass code from your confirmation email.');
      return;
    }
    setState('submitting');
    try {
      const result = await api.cancelRegistration(code);
      setMessage(result.message || 'Your registration has been cancelled.');
      setState('cancelled');
    } catch (err) {
      let msg = 'Failed to cancel your registration. Please try again.';
      if (err instanceof KalunaApiError) {
        msg = err.message || msg;
      } else if (err instanceof Error && err.message) {
        msg = err.message;
      }
      setMessage(msg);
      setState('error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: appleSpringEase }}
      className="max-w-xl mx-auto px-4 py-16 space-y-8 text-center"
    >
      {state === 'idle' || state === 'confirming' ? (
        <>
          <div className="space-y-3">
            <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-800 flex items-center justify-center mx-auto text-rose-400">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Registration</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              {state === 'confirming' ? 'Are you sure?' : 'Cancel a Registration'}
            </h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Cancelling releases your seat so someone on the waitlist can attend. This cannot be undone.
            </p>
          </div>

          <form onSubmit={handleConfirm} className="space-y-5 max-w-sm mx-auto">
            <Input
              label="Pass Code"
              type="text"
              placeholder="e.g. 8a12a9ff-563b-4b47-bc1e-b11362879b35"
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value)}
              disabled={state === 'confirming' && Boolean(initialCode)}
              helperText="Found in your confirmation email."
              icon={<XCircle className="w-4 h-4" />}
            />
            <Button
              type="submit"
              variant="white"
              size="lg"
              className="w-full justify-center font-bold"
              isLoading={isSubmitting}
            >
              Cancel My Registration
            </Button>
          </form>
        </>
      ) : state === 'cancelled' ? (
        <>
          <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-800 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Registration Cancelled</h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">{message}</p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link href="/">
              <Button variant="white" size="md" className="gap-2 font-bold">
                <ArrowLeft className="w-4 h-4 text-slate-950" />
                <span>Back to Events</span>
              </Button>
            </Link>
            <Link href="/lookup">
              <Button variant="outline" size="md" className="gap-2">
                <span>Ticket Lookup</span>
              </Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="w-14 h-14 rounded-full bg-rose-950/80 border border-rose-800 flex items-center justify-center mx-auto text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Couldn&apos;t Cancel</h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">{message}</p>
          <Button variant="outline" size="md" onClick={() => setState('confirming')} className="gap-2">
            <span>Try Again</span>
          </Button>
        </>
      )}
    </motion.div>
  );
}

export default function CancelRegistrationPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#090A0F] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <React.Suspense
        fallback={
          <div className="max-w-md mx-auto py-20 px-4">
            <PinkShimmerSkeleton className="h-96 w-full rounded-2xl" />
          </div>
        }
      >
        <CancelContent />
      </React.Suspense>
    </div>
  );
}
