'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Event, EventCategory, ApiError } from '@/lib/types';
import { api, KalunaApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/badge';
import { PinkShimmerSkeleton, EventCardSkeleton } from '@/components/ui/skeleton';
import { Calendar, MapPin, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { AvatarStack } from '@/components/ui/avatar-stack';
import { EventImage } from '@/components/ui/event-image';
import { cn } from '@/lib/utils';

export default function Home() {
  const [selectedCategory, setSelectedCategory] = React.useState<EventCategory | 'All'>('All');
  const [events, setEvents] = React.useState<Event[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [apiError, setApiError] = React.useState<ApiError | null>(null);

  const categories: (EventCategory | 'All')[] = ['All', 'Tech', 'Books', 'Workshop'];

  const fetchEvents = React.useCallback(async (cat: EventCategory | 'All') => {
    setIsLoading(true);
    setApiError(null);
    try {
      const data = await api.getEvents({ category: cat });
      setEvents(data);
    } catch (err: any) {
      if (err instanceof KalunaApiError) {
        setApiError({
          message: err.message,
          errorCode: err.errorCode,
          statusCode: err.statusCode,
        });
      } else {
        setApiError({
          message: err?.message || 'Failed to connect to event catalog server.',
          errorCode: 'INTERNAL_ERROR',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchEvents(selectedCategory);
  }, [selectedCategory, fetchEvents]);

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  return (
    <div className="min-h-screen pb-24 bg-white dark:bg-[#1C1C1E] transition-colors duration-300">
      {/* Editorial Hero Section */}
      <section className="pt-24 pb-20 border-b border-slate-100 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-block px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-full text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Kaluna Editorial Events
          </div>

          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-bold tracking-tighter text-slate-900 dark:text-white uppercase leading-[0.9]">
            Curated <br /> Technical <br /> Workshops
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-lg sm:text-2xl font-medium max-w-2xl mx-auto leading-relaxed">
            Discover upcoming sessions, reserve instant QR ticket passes, and check in seamlessly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-8">
            <Link href="/lookup">
              <Button variant="primary" size="lg" className="font-bold uppercase tracking-widest">
                Lookup Pass
              </Button>
            </Link>
            <Link href="/admin/login">
              <Button variant="secondary" size="lg" className="font-bold uppercase tracking-widest">
                Admin Console
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Catalog & Filter Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 space-y-12">
        {/* Interactive Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b-2 border-slate-200 dark:border-slate-800 pb-8">
          <div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tighter uppercase">Explore</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-wider transition-all duration-200',
                    active 
                      ? 'bg-slate-900 text-white shadow-soft dark:bg-white dark:text-slate-900' 
                      : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  )}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* API Error State handling */}
        {apiError && (
          <div className="p-8 border-4 border-rose-600 bg-rose-50 dark:bg-rose-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-rose-600 shrink-0" />
              <div>
                <h4 className="font-black text-rose-900 dark:text-rose-400 text-xl uppercase tracking-wider">
                  Catalog Load Error [{apiError.errorCode}]
                </h4>
                <p className="text-base text-rose-700 dark:text-rose-300/80 font-medium mt-1">
                  {apiError.message || 'Failed to fetch events from API.'}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={() => fetchEvents(selectedCategory)}
              className="font-bold uppercase tracking-wider border-2 border-rose-600 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-none"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              <span>Retry</span>
            </Button>
          </div>
        )}

        {/* Pink Shimmer Skeleton Loading State */}
        {isLoading && !apiError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !apiError && events.length === 0 && (
          <div className="py-32 text-center border-4 border-slate-200 dark:border-slate-800 space-y-6">
            <h3 className="text-4xl font-bold text-slate-900 dark:text-white uppercase tracking-tighter">No Events Found</h3>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-md mx-auto">
              There are currently no events listed under the "{selectedCategory}" category.
            </p>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setSelectedCategory('All')}
              className="font-bold uppercase tracking-wider border-2 border-slate-900 text-slate-900 dark:border-white dark:text-white rounded-none"
            >
              Show All
            </Button>
          </div>
        )}

        {/* Event Grid */}
        {!isLoading && !apiError && events.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: {
                  staggerChildren: 0.1,
                },
              },
            }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            <AnimatePresence mode="popLayout">
              {events.map((event) => (
                <motion.div
                  key={event.id || event.eventId}
                  layout
                  variants={{
                    hidden: { opacity: 0, y: 10, scale: 0.98, filter: 'blur(4px)' },
                    visible: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: 'blur(0px)',
                      transition: { duration: 0.5, ease: appleSpringEase },
                    },
                  }}
                  exit={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                >
                  <Card className="flex flex-col h-full justify-between group rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-soft hover:shadow-lg dark:hover:border-slate-700 bg-white dark:bg-[#1C1C1E] transition-all duration-400 overflow-hidden">
                    <div>
                      <div className="relative h-64 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
                        <EventImage
                          src={event.imageUrl}
                          seed={event.eventId || event.id || event.name}
                          alt={event.name || event.title || 'Event'}
                          className="transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                        <div className="absolute top-4 right-4">
                          <StatusBadge status={event.status} />
                        </div>
                      </div>

                      <CardHeader className="pt-6">
                        <CardTitle className="text-2xl font-bold uppercase tracking-tight line-clamp-2 text-slate-900 dark:text-white">
                          {event.name || event.title}
                        </CardTitle>
                        <CardDescription className="text-base font-medium text-slate-600 dark:text-slate-400 line-clamp-3 mt-4">
                          {event.date ? `${event.date} • ${event.venue || event.location || 'Venue TBD'}` : 'Event details will be shared soon.'}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-3 font-mono text-sm text-slate-700 dark:text-slate-300 font-bold">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4" />
                          <span>{event.date}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">{event.venue || event.location || 'Venue TBD'}</span>
                        </div>
                      </CardContent>
                    </div>

                    <CardFooter className="pt-6 pb-6 flex-col items-start gap-4">
                      <AvatarStack registeredCount={Math.max(0, event.capacity - event.seatsRemaining)} className="w-full" />
                      <div className="flex items-center justify-between w-full border-t-2 border-slate-100 dark:border-slate-800 pt-6">
                        <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                          {event.seatsRemaining > 0 ? `${event.seatsRemaining} spots left` : 'Sold out'}
                        </span>
                        <Link href={`/events/detail?id=${event.slug || event.id || event.eventId}`}>
                          <Button variant="primary" size="md" className="font-bold uppercase tracking-widest text-xs transition-colors duration-300">
                            <span>Get Pass</span>
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
    </div>
  );
}
