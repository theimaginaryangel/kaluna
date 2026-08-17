"use client";

import * as React from "react";
import Link from "next/link";
import { AdminStats, Event, Registration } from "@/lib/types";
import { api, isCreatorMode, getCreatorEmail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge, CategoryBadge } from "@/components/ui/badge";
import { PinkShimmerSkeleton } from "@/components/ui/skeleton";
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
  Trash2,
  UserRound,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useRouter } from "next/navigation";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [events, setEvents] = React.useState<Event[]>([]);
  const [checkIns, setCheckIns] = React.useState<Registration[]>([]);
  const [checkInStats, setCheckInStats] = React.useState<
    Record<string, { checkedIn: number; total: number }>
  >({});
  const [waitlistByEvent, setWaitlistByEvent] = React.useState<
    Record<string, Registration[]>
  >({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExporting, setIsExporting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<"my-events" | "all-events">(
    "my-events",
  );
  const [expandedWaitlist, setExpandedWaitlist] = React.useState<string | null>(
    null,
  );
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [userGroups, setUserGroups] = React.useState<string[]>([]);
  const [callerSub, setCallerSub] = React.useState("");

  const isAdmin = userGroups.includes("Admin");
  const creatorMode = isCreatorMode();
  const creatorEmail = getCreatorEmail();

  const loadDashboardData = React.useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [adminStats, eventsList] = await Promise.all([
        api.getAdminStats(),
        api.getEvents(),
      ]);
      setStats(adminStats);
      setEvents(eventsList);

      // Fetch check-ins for all events in parallel
      const checkInResults = await Promise.allSettled(
        eventsList.map((e) => api.getCheckIns(e.eventId || e.id)),
      );
      const allAttendees = checkInResults
        .flatMap((r) => (r.status === "fulfilled" ? r.value.attendees : []))
        .filter((a) => a.status === "checked_in")
        .sort((a, b) => (b.registeredAt > a.registeredAt ? 1 : -1))
        .slice(0, 20);
      setCheckIns(allAttendees);

      // Per-event check-in stats for the checked-in badge
      const statsMap: Record<string, { checkedIn: number; total: number }> = {};
      checkInResults.forEach((r, idx) => {
        const ev = eventsList[idx];
        if (r.status === "fulfilled") {
          statsMap[ev.eventId || ev.id] = {
            checkedIn: r.value.checkedIn,
            total: r.value.total,
          };
        }
      });
      setCheckInStats(statsMap);

      // Per-event registrations → waitlisted users shown under each event
      const registrationResults = await Promise.allSettled(
        eventsList.map((e) => api.getRegistrations(e.eventId || e.id)),
      );
      const waitlistMap: Record<string, Registration[]> = {};
      registrationResults.forEach((r, idx) => {
        const ev = eventsList[idx];
        if (r.status === "fulfilled") {
          const waitlisted = r.value.filter(
            (reg) => reg.status === "waitlisted",
          );
          if (waitlisted.length > 0) {
            waitlistMap[ev.eventId || ev.id] = waitlisted;
          }
        }
      });
      setWaitlistByEvent(waitlistMap);
    } catch (err) {
      console.error("Failed to load admin stats", err);
      setLoadError(
        err instanceof Error ? err.message : "Failed to load dashboard data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("kaluna_jwt_token");
      if (!token && !isCreatorMode()) {
        router.push("/admin");
        return;
      }
      const payload = token ? decodeJwtPayload(token) : null;
      const groupsClaim = payload?.["cognito:groups"];
      const groups = Array.isArray(groupsClaim)
        ? groupsClaim.map((g) => String(g).trim()).filter(Boolean)
        : String(groupsClaim || "")
            .replace(/[\[\]]/g, "")
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean);
      setUserGroups(groups);
      setCallerSub(String(payload?.["sub"] || ""));
      if (!groups.includes("Admin")) {
        setActiveTab("my-events");
      }
    }
    loadDashboardData();
  }, [loadDashboardData, router]);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("kaluna_jwt_token");
      window.localStorage.removeItem("kaluna_admin_user");
    }
    router.push("/admin/creator-login");
  };

  const handleDelete = async (eventId: string, eventName: string) => {
    if (!window.confirm(`Delete "${eventName}"? This cannot be undone.`))
      return;
    setDeletingId(eventId);
    try {
      await api.deleteEvent(eventId);
      setEvents((prev) => prev.filter((e) => (e.eventId || e.id) !== eventId));
    } catch (err) {
      console.error("Failed to delete event", err);
      alert("Failed to delete event. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCSV = async (eventId?: string) => {
    setIsExporting(true);
    try {
      const targets = eventId
        ? displayedEvents.filter((e) => (e.eventId || e.id) === eventId)
        : displayedEvents;
      const csvHeaders = [
        "Registration ID",
        "Event Title",
        "Attendee Name",
        "Attendee Email",
        "Ticket Code",
        "Status",
        "Registered At",
      ];
      const csvRows: string[][] = [];
      for (const ev of targets) {
        const registrations = await api.getRegistrations(ev.eventId || ev.id);
        const eventTitle = ev.name || ev.title || ev.eventId;
        registrations.forEach((r) =>
          csvRows.push([
            `"${r.id}"`,
            `"${r.eventTitle || eventTitle}"`,
            `"${r.userName || r.name || ""}"`,
            `"${r.userEmail || r.email || ""}"`,
            `"${r.ticketCode || ""}"`,
            `"${r.status}"`,
            `"${r.registeredAt}"`,
          ]),
        );
      }

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((e) => e.join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `kaluna-registrations-${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export CSV", err);
    } finally {
      setIsExporting(false);
    }
  };

  const displayedEvents = React.useMemo(() => {
    if (activeTab === "all-events") {
      return events;
    }
    // Creator mode — the API already scopes the list to the creator's email.
    if (creatorMode) {
      return events;
    }
    // Creator view — only events this user owns
    if (callerSub) {
      return events.filter((e) => e.ownerId === callerSub);
    }
    return events.slice(0, Math.max(1, Math.floor(events.length / 2)));
  }, [events, activeTab, callerSub, creatorMode]);

  const tabStats = React.useMemo(() => {
    if (activeTab === "all-events") {
      return {
        totalEvents: stats?.totalEvents ?? events.length,
        totalRegistrations: stats?.totalRegistrations ?? 0,
        totalCheckIns: checkIns.length,
        capacityUtilization: stats?.capacityUtilization ?? 0,
      };
    }
    // Creator view — scoped to displayedEvents only
    const myEvents = displayedEvents;
    const myRegistered = myEvents.reduce(
      (acc, e) => acc + Math.max(0, e.capacity - e.seatsRemaining),
      0,
    );
    const myCapacity = myEvents.reduce((acc, e) => acc + e.capacity, 0);
    const myEventIds = new Set(myEvents.map((e) => e.eventId || e.id));
    const myCheckIns = checkIns.filter((c) => myEventIds.has(c.eventId)).length;
    return {
      totalEvents: myEvents.length,
      totalRegistrations: myRegistered,
      totalCheckIns: myCheckIns,
      capacityUtilization:
        myCapacity > 0 ? Math.round((myRegistered / myCapacity) * 100) : 0,
    };
  }, [activeTab, displayedEvents, events, stats, checkIns]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0A0A] text-slate-900 dark:text-slate-100 pb-24 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header & Quick Action Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {creatorMode
                  ? "Creator Management Console"
                  : "Admin Management Console"}
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {creatorMode
                ? "Real-time check-in stream, capacity analytics, and controls for your events"
                : "Real-time check-in stream, capacity utilization analytics, and event controls"}
            </p>
            {creatorMode && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                {creatorEmail}
              </span>
            )}
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
              onClick={() => handleExportCSV()}
              isLoading={isExporting}
              className="gap-2 text-xs w-full sm:w-auto"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span>Export CSV</span>
            </Button>

            <Link href="/admin/events/new" className="w-full sm:w-auto">
              <Button
                variant="white"
                size="sm"
                className="gap-2 font-bold text-xs w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>Create Event</span>
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 w-full sm:w-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </Button>
          </div>
        </div>

        {/* Roles / Views Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab("my-events")}
            className={cn(
              "px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200",
              activeTab === "my-events"
                ? "bg-slate-900 text-white shadow-soft dark:bg-white dark:text-slate-900"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            My Events (Creator)
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab("all-events")}
              className={cn(
                "px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200",
                activeTab === "all-events"
                  ? "bg-slate-900 text-white shadow-soft dark:bg-white dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
              )}
            >
              All Events (Godmode)
            </button>
          )}
        </div>

        {/* Error banner */}
        {loadError && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {loadError}
          </div>
        )}

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
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"></div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {tabStats.totalEvents}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeTab === "my-events"
                    ? "Your event listings"
                    : "Active event listings"}
                </p>
              </div>
            </Card>

            {/* Card 2: Total Registrations */}
            <Card hoverable={false} className="p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Total Registrations
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"></div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {tabStats.totalRegistrations}
                </span>
                <p className="text-[11px] text-emerald-400 mt-1">
                  {activeTab === "my-events"
                    ? "Across your events"
                    : "Platform-wide total"}
                </p>
              </div>
            </Card>

            {/* Card 3: Check-ins Count */}
            <Card hoverable={false} className="p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Check-Ins Count
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-emerald-500 dark:text-emerald-400"></div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {tabStats.totalCheckIns}
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeTab === "my-events"
                    ? "At your events"
                    : "Scanned at venue door"}
                </p>
              </div>
            </Card>

            {/* Card 4: Capacity Utilization */}
            <Card hoverable={false} className="p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Capacity Utilization
                </span>
                <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"></div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
                  {tabStats.capacityUtilization}%
                </span>
                <p className="text-[11px] text-slate-400 mt-1">
                  {activeTab === "my-events"
                    ? "Your events fill rate"
                    : "Overall fill rate"}
                </p>
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Event Capacity & Fill Progress
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Track registrations against total capacity per event
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  {displayedEvents.length} Events
                </span>
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
                    const eventKey = event.eventId || event.id;
                    const fillPercent = Math.min(
                      100,
                      Math.round(
                        ((event.capacity - event.seatsRemaining) /
                          (event.capacity || 1)) *
                          100,
                      ),
                    );
                    const registeredCount = Math.max(
                      0,
                      event.capacity - event.seatsRemaining,
                    );
                    const checkStat = checkInStats[eventKey];
                    const waitlisted = waitlistByEvent[eventKey] || [];
                    const isWaitlistOpen = expandedWaitlist === eventKey;
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
                              {registeredCount} / {event.capacity} (
                              {fillPercent}%)
                            </span>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/admin/events/edit?id=${event.id || event.eventId}`}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-xs gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                                >
                                  <Edit className="w-3 h-3" />
                                  <span>Edit</span>
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleExportCSV(event.eventId || event.id)
                                }
                                isLoading={isExporting}
                                className="h-7 px-2 text-xs gap-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                                title={`Export ${event.name || event.title} registrations`}
                              >
                                <Download className="w-3 h-3" />
                                <span>CSV</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  handleDelete(
                                    event.eventId || event.id,
                                    event.name || event.title || "",
                                  )
                                }
                                isLoading={
                                  deletingId === (event.eventId || event.id)
                                }
                                className="h-7 px-2 text-xs gap-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Live badge: checked-in vs registered */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                          {checkStat && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              {checkStat.checkedIn} checked in /{" "}
                              {registeredCount} registered
                            </span>
                          )}
                          {waitlisted.length > 0 && (
                            <button
                              onClick={() =>
                                setExpandedWaitlist(
                                  isWaitlistOpen ? null : eventKey,
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FF2D87]/10 border border-[#FF2D87]/30 text-[#FF2D87] hover:bg-[#FF2D87]/20 transition-colors"
                            >
                              <Users className="w-3 h-3" />
                              {waitlisted.length} on waitlist
                              <span className="text-[9px]">
                                {isWaitlistOpen ? "▴" : "▾"}
                              </span>
                            </button>
                          )}
                        </div>

                        {isWaitlistOpen && waitlisted.length > 0 && (
                          <div className="space-y-1.5 border border-[#FF2D87]/20 rounded-lg p-3 bg-[#FF2D87]/[0.03]">
                            <p className="text-[10px] uppercase tracking-wider font-mono font-bold text-[#FF2D87]/80">
                              Waitlisted Attendees
                            </p>
                            {waitlisted.map((wl) => (
                              <div
                                key={wl.ticketId || wl.id}
                                className="flex items-center justify-between text-xs gap-2"
                              >
                                <span className="text-slate-900 dark:text-white font-medium truncate">
                                  {wl.userName || wl.name}
                                </span>
                                <span className="text-slate-500 dark:text-slate-400 truncate">
                                  {wl.userEmail || wl.email}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Capacity Bar */}
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              fillPercent >= 100
                                ? "bg-rose-500"
                                : fillPercent >= 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
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
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Live Check-In Feed
                  </h3>
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
                  {checkIns.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-6">
                      No check-ins yet.
                    </p>
                  ) : (
                    checkIns.map((chk) => (
                      <div
                        key={chk.ticketId || chk.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-[#090A0F] border border-slate-200 dark:border-slate-800 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-700 dark:text-slate-300 font-bold truncate max-w-[120px]">
                            {chk.ticketId || chk.ticketCode}
                          </span>
                          <Badge
                            variant="available"
                            className="text-[10px] py-0 px-2 uppercase shrink-0"
                          >
                            checked in
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-900 dark:text-white font-medium truncate">
                          {chk.userName || chk.name}
                        </p>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          {chk.userEmail || chk.email}
                        </p>
                        <div className="text-[10px] text-slate-500 font-mono pt-1 border-t border-slate-200 dark:border-slate-900">
                          {chk.registeredAt?.split("T")[1]?.slice(0, 8) ||
                            chk.registeredAt}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
