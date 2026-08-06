'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { EditEventClient } from '@/components/admin/edit-event-client';

function EditEventParamsLoader() {
  const searchParams = useSearchParams();
  const id = searchParams?.get('id');

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#090A0F]">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black uppercase text-slate-900 dark:text-white">Event Not Found</h1>
          <p className="text-slate-600 dark:text-slate-400">No event ID was provided for editing.</p>
        </div>
      </div>
    );
  }

  return <EditEventClient id={id} />;
}

export default function EditEventPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 space-y-4">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
          <div className="h-96 w-full bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
        </div>
      }
    >
      <EditEventParamsLoader />
    </Suspense>
  );
}
