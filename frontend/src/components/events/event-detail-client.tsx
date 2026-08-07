'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Event, ApiError } from '@/lib/types';
import { api, KalunaApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { CategoryBadge, StatusBadge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { PinkShimmerSkeleton } from '@/components/ui/skeleton';
import { RegistrationForm } from '@/components/events/registration-form';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  ExternalLink,
  ArrowLeft,
  AlertCircle,
  Share2,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function EventDetailClient({ id }: { id: string }) {
  const [event, setEvent] = React.useState<Event | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = React.useState<boolean>(false);

  React.useEffect(() => {
    async function loadEvent() {
      setIsLoading(true);
      setError(null);
      try {
        let fetchedEvent: Event;
        if (id.startsWith('evt-') || id.startsWith('demo-')) {
          fetchedEvent = await api.getEventById(id);
        } else {
          try {
            fetchedEvent = await api.getEventBySlug(id);
          } catch {
            fetchedEvent = await api.getEventById(id);
          }
        }
        setEvent(fetchedEvent);
      } catch (err: any) {
        if (err instanceof KalunaApiError) {
          setError({
            message: err.message,
            errorCode: err.errorCode,
            statusCode: err.statusCode,
          });
        } else {
          setError({
            message: err?.message || 'Event not found or failed to load.',
            errorCode: 'EVENT_NOT_FOUND',
            statusCode: 404,
          });
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadEvent();
  }, [id]);

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <PinkShimmerSkeleton className="h-8 w-32 rounded-lg" />
        <PinkShimmerSkeleton className="h-80 w-full rounded-none" />
        <PinkShimmerSkeleton className="h-10 w-3/4 rounded-lg" />
        <PinkShimmerSkeleton className="h-24 w-full rounded-none" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-32 text-center space-y-8">
        <div className="p-12 border-4 border-slate-900 dark:border-white space-y-6 bg-slate-50 dark:bg-slate-900">
          <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/80 border-4 border-rose-600 flex items-center justify-center mx-auto text-rose-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-4xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">Event Not Found</h2>
          <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
            {error?.message || `We couldn't find an event with identifier "${id}".`}
          </p>
          <div className="pt-4">
            <Link href="/">
              <Button variant="outline" size="lg" className="border-2 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-slate-900 rounded-none font-bold uppercase tracking-widest">
                Return to Events
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const capacityPercentage = Math.min(
    100,
    Math.round(((event.capacity - event.seatsRemaining) / (event.capacity || 1)) * 100)
  );
  const remainingSpots = Math.max(0, event.seatsRemaining);
  const isSoldOut = event.status === 'Sold Out' || remainingSpots <= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={{ duration: 0.5, ease: appleSpringEase }}
      className="min-h-screen pb-32 bg-white dark:bg-[#1C1C1E] transition-colors duration-300"
    >
      {/* Top Navigation / Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold font-mono text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors ring-pink-focus uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Banner Image Frame */}
        <div className="relative w-full h-80 sm:h-[28rem] overflow-hidden rounded-3xl border border-transparent shadow-soft bg-slate-100 dark:bg-slate-900">
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-400 dark:from-slate-800 dark:to-slate-700">
            <span className="text-3xl font-semibold uppercase tracking-[0.3em] text-slate-700 dark:text-slate-200">
              {event.name || event.title}
            </span>
          </div>
          
          {/* Badges overlay */}
          <div className="absolute top-6 left-6 flex items-center gap-3">
            <StatusBadge status={event.status} />
          </div>
        </div>

        {/* Title & Key Highlights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Main Info (Left 2 Columns) */}
          <div className="lg:col-span-2 space-y-10">
            <div className="space-y-6">
              <h1 className="text-4xl sm:text-6xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter leading-[0.9]">
                {event.name || event.title}
              </h1>
            </div>

            {/* Event Description */}
            <div className="p-8 rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-soft bg-white dark:bg-[#1C1C1E] space-y-6">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">About this Event</h3>
              <p className="text-slate-700 dark:text-slate-300 text-base sm:text-lg font-medium leading-relaxed whitespace-pre-line">
                This event is scheduled for {event.date} at {event.venue || event.location || 'the venue listed below'}.
              </p>
            </div>
          </div>

          {/* Registration Sidebar Card (Right 1 Column) */}
          <div className="space-y-8">
            <div className="p-8 rounded-3xl border border-slate-100 dark:border-slate-800/50 bg-white dark:bg-[#1C1C1E] space-y-8 sticky top-28 shadow-soft transition-colors">
              <div className="flex flex-col gap-2 border-b border-slate-100 dark:border-slate-800/50 pb-6">
                <span className="text-sm font-bold font-mono uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Event Status
                </span>
                <span className="text-4xl font-bold font-mono text-slate-900 dark:text-white">
                  {isSoldOut ? 'Sold Out' : 'Open'}
                </span>
              </div>

              {/* Time & Location details */}
              <div className="space-y-6 py-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-4">
                  <Calendar className="w-5 h-5 text-slate-900 dark:text-white shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wide">Date & Time</span>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">
                      {event.date}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-slate-900 dark:text-white shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wide">Venue Location</span>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">{event.venue || event.location || 'Venue TBD'}</p>
                  </div>
                </div>

                {!event.venue && (
                  <div className="flex items-start gap-4">
                    <ExternalLink className="w-5 h-5 text-slate-900 dark:text-white shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wide">Venue Details</span>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">Venue details will be shared closer to the event date.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Capacity Progress Bar */}
              <div className="space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-slate-500 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>Capacity</span>
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {Math.max(0, event.capacity - event.seatsRemaining)} / {event.capacity}
                  </span>
                </div>

                {/* Progress bar container */}
                <div className="w-full h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <div
                    className={cn(
                      'h-full transition-all duration-500',
                      capacityPercentage >= 100
                        ? 'bg-rose-500'
                        : capacityPercentage >= 80
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    )}
                    style={{ width: `${capacityPercentage}%` }}
                  />
                </div>

                <p className="text-xs font-bold text-slate-500 text-right uppercase tracking-wider">
                  {isSoldOut ? 'Event Full' : `${remainingSpots} spots available`}
                </p>
              </div>

              {/* Action Button Trigger Modal */}
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsRegisterModalOpen(true)}
                disabled={isSoldOut}
                className="w-full justify-center font-bold text-lg uppercase tracking-widest rounded-full h-14"
              >
                {isSoldOut ? 'Closed' : 'Register Now'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Registration Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title={`Register for ${event.name || event.title}`}
        description="Enter your attendee details below to generate your digital QR pass."
        maxWidth="md"
      >
        <RegistrationForm event={event} />
      </Modal>
    </motion.div>
  );
}
