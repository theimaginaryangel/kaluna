"use client";

import * as React from "react";
import Link from "next/link";
import { Event } from "@/lib/types";
import { api } from "@/lib/api";
import { EventForm } from "@/components/admin/event-form";
import { PinkShimmerSkeleton } from "@/components/ui/skeleton";
import { ArrowLeft, PencilLine, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EditEventClient({ id }: { id: string }) {
  const [event, setEvent] = React.useState<Event | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadEvent() {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const data = await api.getEventById(id);
        setEvent(data);
      } catch (err: any) {
        setErrorMsg(err?.message || `Could not find event with ID '${id}'.`);
      } finally {
        setIsLoading(false);
      }
    }
    loadEvent();
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <PinkShimmerSkeleton className="h-8 w-40 rounded-lg" />
        <PinkShimmerSkeleton className="h-[500px] w-full rounded-3xl" />
      </div>
    );
  }

  if (errorMsg || !event) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="p-8 rounded-3xl bg-[#141622] border border-[#272B40] space-y-4">
          <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
          <h2 className="text-xl font-bold text-white">Event Not Found</h2>
          <p className="text-sm text-slate-400">{errorMsg}</p>
          <Link href="/admin/dashboard">
            <Button variant="white" size="md">
              Return to Admin Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 pb-24 pt-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition-colors ring-pink-focus rounded px-2 py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Admin Dashboard</span>
        </Link>

        {/* Form Container */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#141622] border border-[#272B40] shadow-2xl space-y-6">
          <div className="space-y-1.5 border-b border-[#272B40] pb-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-300">
              <PencilLine className="w-3.5 h-3.5 text-slate-400" />
              <span>Event Editor</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight pt-1">
              Edit Event: {event.name || event.title}
            </h1>
            <p className="text-xs text-slate-400">
              Update the event name, date, venue, or maximum capacity.
            </p>
          </div>

          <EventForm initialEvent={event} isEditMode={true} />
        </div>
      </div>
    </div>
  );
}
