'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Ticket, ApiError } from '@/lib/types';
import { api, KalunaApiError } from '@/lib/api';
import { QRTicket } from '@/components/ui/qr-ticket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PinkShimmerSkeleton } from '@/components/ui/skeleton';
import { Search, Ticket as TicketIcon, CheckCircle2, AlertCircle, RefreshCw, QrCode } from 'lucide-react';

export default function TicketLookupPage() {
  const [query, setQuery] = React.useState('');
  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCheckingIn, setIsCheckingIn] = React.useState(false);
  const [checkInSuccessMsg, setCheckInSuccessMsg] = React.useState('');
  const [error, setError] = React.useState<ApiError | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setTicket(null);
    setCheckInSuccessMsg('');

    try {
      const result = await api.getTicket(query.trim());
      setTicket(result);
    } catch (err: any) {
      if (err instanceof KalunaApiError) {
        setError({
          message: err.message,
          errorCode: err.errorCode,
          statusCode: err.statusCode,
        });
      } else {
        setError({
          message: `No ticket pass found matching '${query.trim()}'. Please verify ticket code or registered email.`,
          errorCode: 'INVALID_TICKET',
          statusCode: 404,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckInAction = async () => {
    if (!ticket) return;
    setIsCheckingIn(true);
    setError(null);
    setCheckInSuccessMsg('');

    try {
      const checkInResult = await api.checkInTicket(ticket.ticketCode);
      setCheckInSuccessMsg(`Attendee ${checkInResult.userName} successfully checked in!`);
      // Update local ticket state
      setTicket((prev) =>
        prev
          ? {
              ...prev,
              status: 'used',
              checkedInAt: checkInResult.timestamp,
            }
          : null
      );
    } catch (err: any) {
      setTicket(null);
      if (err instanceof KalunaApiError) {
        setError({
          message: err.message,
          errorCode: err.errorCode,
          statusCode: err.statusCode,
        });
      } else {
        setError({
          message: err?.message || 'Check-in processing failed.',
          errorCode: 'INVALID_TICKET',
        });
      }
    } finally {
      setIsCheckingIn(false);
    }
  };

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 pb-24 pt-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
            <QrCode className="w-3.5 h-3.5 text-slate-400" />
            <span>Digital Ticket Verification & Check-In</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Ticket Lookup & Check-In
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Search by pass code (e.g. KALUNA-7F3K9Q).
          </p>
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSearch} className="p-4 rounded-2xl bg-[#141622] border border-[#272B40] space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Input
              type="text"
              placeholder="Enter Ticket Code or Email (e.g. KALUNA-7F3K9Q)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
              className="w-full"
            />
            <Button
              type="submit"
              variant="white"
              size="md"
              isLoading={isLoading}
              className="w-full sm:w-auto shrink-0 font-bold"
            >
              Verify Pass
            </Button>
          </div>
        </form>

        {/* Loading State */}
        {isLoading && (
          <div className="py-8 space-y-4 text-center">
            <PinkShimmerSkeleton className="h-80 w-full max-w-md mx-auto rounded-2xl" />
          </div>
        )}

        {/* Error State Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 space-y-2 text-sm"
          >
            <div className="flex items-center gap-2 font-bold text-rose-300">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Lookup Error [{error.errorCode}]</span>
            </div>
            <p className="text-rose-300/90 leading-relaxed">{error.message}</p>
          </motion.div>
        )}

        {/* Check-in Success Banner */}
        {checkInSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 flex items-center gap-3 text-sm font-semibold"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{checkInSuccessMsg}</span>
          </motion.div>
        )}

        {/* Ticket Details View Card */}
        {ticket && !isLoading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: appleSpringEase }}
            className="space-y-6"
          >
            {/* Status Summary Banner */}
            <div className="p-4 rounded-2xl bg-[#141622] border border-[#272B40] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TicketIcon className="w-5 h-5 text-slate-400" />
                <div>
                  <span className="text-xs text-slate-400 font-mono block uppercase">Check-In Status</span>
                  <span className="text-sm font-bold text-white">
                    {ticket.status === 'used' ? 'Checked In' : 'Pending Check-In'}
                  </span>
                </div>
              </div>

              <Badge variant={ticket.status === 'used' ? 'soldOut' : 'available'} className="text-xs uppercase tracking-wider">
                {ticket.status === 'used' ? 'Checked In' : 'Valid Ticket'}
              </Badge>
            </div>

            {/* QRTicket Card */}
            <QRTicket ticket={ticket} />

            {/* Perform Check-in Button */}
            {ticket.status !== 'used' && (
              <div className="pt-2 text-center">
                <Button
                  variant="white"
                  size="lg"
                  onClick={handleCheckInAction}
                  isLoading={isCheckingIn}
                  className="w-full max-w-md mx-auto justify-center font-bold text-sm shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Perform Venue Check-In</span>
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
