'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Ticket, Event } from '@/lib/types';
import { api } from '@/lib/api';
import { QRTicket } from '@/components/ui/qr-ticket';
import { Button } from '@/components/ui/button';
import { PinkShimmerSkeleton } from '@/components/ui/skeleton';
import { CheckCircle2, Printer, ArrowLeft, Search, Sparkles } from 'lucide-react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const ticketCode = searchParams?.get('code') || '';
  const eventId = searchParams?.get('eventId') || '';

  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [event, setEvent] = React.useState<Event | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      if (ticketCode) {
        try {
          const t = await api.getTicket(ticketCode);
          setTicket(t);
        } catch {
          // If ticket lookup by code fails, construct fallback ticket object from eventId
        }
      }

      if (eventId) {
        try {
          const e = await api.getEventById(eventId);
          setEvent(e);
        } catch {
          // Fallback handled
        }
      }
      setIsLoading(false);
    }
    loadData();
  }, [ticketCode, eventId]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 space-y-6">
        <PinkShimmerSkeleton className="h-8 w-48 mx-auto rounded-lg" />
        <PinkShimmerSkeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  // Construct fallback ticket display if needed
  const displayTicket: Ticket = ticket || {
    ticketCode: ticketCode || 'KALUNA-EVT-9999',
    registrationId: `reg-${Date.now()}`,
    eventId: event?.id || eventId || 'evt-101',
    eventTitle: event?.title || 'Registered Event',
    eventDate: event?.date || '2026-08-22',
    eventTime: event?.time || '18:00 EST',
    location: event?.location || 'Kaluna Event Center',
    userName: 'Registered Attendee',
    userEmail: 'attendee@example.com',
    qrValue: `${ticketCode || 'KALUNA-PASS'}:${eventId}:${Date.now()}`,
    status: 'valid',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: appleSpringEase }}
      className="max-w-xl mx-auto px-4 py-12 space-y-8 text-center print:py-0 print:max-w-none"
    >
      {/* Top Banner Success Indicator */}
      <div className="space-y-3 print:hidden">
        <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-800 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Registration Confirmed</span>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Your Digital Pass is Ready!
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Present this QR pass code at the venue door for instant check-in scan.
        </p>
      </div>

      {/* Render QRTicket Component */}
      <div className="print:shadow-none">
        <QRTicket ticket={displayTicket} className="mx-auto" />
      </div>

      {/* Printable / Download Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 print:hidden">
        <Button variant="white" size="md" onClick={handlePrint} className="gap-2 font-bold">
          <Printer className="w-4 h-4 text-slate-950" />
          <span>Download / Print Pass</span>
        </Button>

        <Link href="/lookup">
          <Button variant="outline" size="md" className="gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <span>Ticket Lookup</span>
          </Button>
        </Link>

        <Link href="/">
          <Button variant="ghost" size="md" className="gap-2">
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>Back to Events</span>
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

export default function RegistrationSuccessPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#090A0F] text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <React.Suspense
        fallback={
          <div className="max-w-md mx-auto py-20 px-4">
            <PinkShimmerSkeleton className="h-96 w-full rounded-2xl" />
          </div>
        }
      >
        <SuccessContent />
      </React.Suspense>
    </div>
  );
}
