'use client';

import * as React from 'react';
import Link from 'next/link';
import { EventForm } from '@/components/admin/event-form';
import { ArrowLeft, CalendarPlus } from 'lucide-react';

export default function CreateEventPage() {
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
              <CalendarPlus className="w-3.5 h-3.5 text-slate-400" />
              <span>New Event Creator</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight pt-1">
              Create New Event
            </h1>
            <p className="text-xs text-slate-400">
              Configure parameters, speaker credentials, and capacity limits for the new session.
            </p>
          </div>

          <EventForm isEditMode={false} />
        </div>
      </div>
    </div>
  );
}
