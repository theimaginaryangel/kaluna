"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EventDetailClient } from "@/components/events/event-detail-client";
import { PinkShimmerSkeleton } from "@/components/ui/skeleton";

function EventDetailParamsLoader() {
  const searchParams = useSearchParams();
  const id = searchParams?.get("id");

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-white dark:bg-[#090A0F]">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black uppercase text-slate-900 dark:text-white">
            Event Not Found
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            No event ID was provided.
          </p>
        </div>
      </div>
    );
  }

  return <EventDetailClient id={id} />;
}

export default function EventDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
          <PinkShimmerSkeleton className="h-8 w-32 rounded-lg" />
          <PinkShimmerSkeleton className="h-80 w-full rounded-2xl" />
          <PinkShimmerSkeleton className="h-10 w-3/4 rounded-lg" />
        </div>
      }
    >
      <EventDetailParamsLoader />
    </Suspense>
  );
}
