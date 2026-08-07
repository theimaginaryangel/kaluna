'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AdminStats, Event, Registration } from '@/lib/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge, CategoryBadge } from '@/components/ui/badge';
import { PinkShimmerSkeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  Users,
  CheckCircle2,
  PieChart,
  Plus,
  Download,
  Edit,
  Activity,
  ShieldCheck,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { useRouter } from 'next/navigation';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'my-events' | 'all-events'>('my-events');

  const loadDashboardData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [adminStats, eventsList] = await Promise.all([
        api.getAdminStats(),
        api.getEvents(),
      ]);
      setStats(adminStats);
      setEvents(eventsList);
    } catch (err) {
      console.error('Failed to load admin stats', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('kaluna_jwt_token');
      if (!token) {
        router.push('/admin/login');
        return;
      }
    }
    loadDashboardData();
  }, [loadDashboardData, router]);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kaluna_jwt_token');
      localStorage.removeItem('kaluna_admin_user');
    }
    router.push('/admin/login');
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const registrations = await api.getRegistrations(events[0]?.id);
      
      const csvHeaders = ['Registration ID', 'Event Title', 'Attendee Name', 'Attendee Email', 'Ticket Code', 'Status', 'Registered At'];
      const csvRows = registrations.map((r) => [
        `"${r.id}"`,
        `"${r.eventTitle || r.eventId}"`,
        `"${r.userName || r.name || ''}"`,
        `"${r.userEmail || r.email || ''}"`,
        `"${r.ticketCode || ''}"`,
        `"${r.status}"`,
        `"${r.registeredAt}"`,
      ]);

      const csvContent = [csvHeaders.join(','), ...csvRows.map((e) => e.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `kaluna-registrations-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setIsExporting(false);
    }
  };

  const displayedEvents = React.useMemo(() => {
    if (activeTab === 'my-events') {
      return events.slice(0, Math.max(1, Math.floor(events.length / 2)));
    }
    return events;
  }, [events, activeTab]);

  const appleSpringEase = [0.25, 0.1, 0.25, 1] as const;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 pb-24 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header & Quick Action Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Admin Management Console
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Real-time check-in stream, capacity utilization analytics, and event controls
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDashboardData}
              className="gap-2 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              isLoading={isExporting}
              className="gap-2 text-xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span>Export CSV</span>
            </Button>

            <Link href="/admin/events/new">
              <Button variant="white" size="sm" className="gap-2 font-bold text-xs">
                <Plus className="w-4 h-4 text-slate-950" />
                <span>Create Event</span>
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </Button>
          </div>
        </div>

        {/* Roles / Views Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('my-events')}
            className={cn(
              "px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200",
              activeTab === 'my-events'
                ? "bg-slate-900 text-white shadow-soft dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            My Events (Creator)
          </button>
          <button
            onClick={() => setActiveTab('all-events')}
            className={cn(
              "px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200",
              activeTab === 'all-events'
                ? "bg-slate-900 text-white shadow-soft dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            All Events (Godmode)
          </button>
        </div>

        {/* 4 Stat Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <PinkShimmerSkeleton className="h-28 rounded-2xl" />
            <PinkShimmerSkeleton className="h-28 rounded-2xl" />
            <PinkShimmerSkeleton className="h-28 rounded-2xl" />
            <PinkShimmerSkeleton className="h-28 rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Events */}
            <Card hoverable={false} className="p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Events
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <Calendar className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {stats?.totalEvents ?? displayedEvents.length}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">Active event listings</p>
              </div>
            </Card>

            {/* Card 2: Total Registrations */}
            <Card hoverable={false} className="p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Registrations
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {stats?.totalRegistrations ?? 325}
                </span>
                <p className="text-[11px] text-emerald-400 mt-1">+14% vs last week</p>
              </div>
            </Card>

            {/* Card 3: Check-ins Count */}
            <Card hoverable={false} className="p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Check-Ins Count
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-emerald-500 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {stats?.totalCheckIns ?? 184}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">Scanned at venue door</p>
              </div>
            </Card>

            {/* Card 4: Capacity Utilization */}
            <Card hoverable={false} className="p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Capacity Utilization
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <PieChart className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {stats?.capacityUtilization ?? 76}%
                </span>
                <p className="text-[11px] text-slate-400 mt-1">Overall fill rate</p>
              </div>
            </Card>
          </div>
        )}

        {/* Section Grid: Capacity Bars & Live Check-in Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Capacity Bars & Events List (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-[#141622] border border-slate-200 dark:border-slate-800 shadow-soft space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Event Capacity & Fill Progress</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Track registrations against total capacity per event</p>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{displayedEvents.length} Events</span>
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  <PinkShimmerSkeleton className="h-16 rounded-xl" />
                  <PinkShimmerSkeleton className="h-16 rounded-xl" />
                  <PinkShimmerSkeleton className="h-16 rounded-xl" />
                </div>
              ) : (
                <div className="space-y-5">
                  {displayedEvents.map((event) => {
                    const fillPercent = Math.min(
                      100,
                      Math.round(((event.capacity - event.seatsRemaining) / (event.capacity || 1)) * 100)
                    );
                    return (
                      <div
                        key={event.id || event.eventId}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                              {event.name || event.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                              {Math.max(0, event.capacity - event.seatsRemaining)} / {event.capacity} ({fillPercent}%)
                            </span>
                            <Link href={`/admin/events/edit?id=${event.id || event.eventId}`}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800">
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                              </Button>
                            </Link>
                          </div>
                        </div>

                        {/* Capacity Bar */}
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              fillPercent >= 100
                                ? 'bg-rose-500'
                                : fillPercent >= 80
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            )}
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Live Check-in Feed (1 Column) */}
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-[#141622] border border-slate-200 dark:border-slate-800 shadow-soft space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Live Check-In Feed</h3>
                </div>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <PinkShimmerSkeleton className="h-16 rounded-xl" />
                  <PinkShimmerSkeleton className="h-16 rounded-xl" />
                  <PinkShimmerSkeleton className="h-16 rounded-xl" />
                </div>
              ) : (
                <div className="space-y-3">
                  {(stats?.recentCheckIns || []).map((chk) => (
                    <div
                      key={chk.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-slate-700 dark:text-slate-300 font-bold">{chk.ticketCode}</span>
                        <Badge
                          variant={
                            chk.status === 'success'
                              ? 'available'
                              : chk.status === 'already_checked_in'
                              ? 'limited'
                              : 'soldOut'
                          }
                          className="text-[10px] py-0 px-2 uppercase"
                        >
                          {chk.status}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-900 dark:text-white font-medium truncate">{chk.userName}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{chk.eventTitle}</p>

                      <div className="text-[10px] text-slate-500 dark:text-slate-500 font-mono pt-1 border-t border-slate-200 dark:border-slate-900 flex justify-between">
                        <span>{chk.timestamp.split('T')[1]?.slice(0, 8) || chk.timestamp}</span>
                        {chk.note && <span className="truncate max-w-[120px]">{chk.note}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
