"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Ticket } from "@/lib/types";
import { api } from "@/lib/api";
import { QRTicket } from "@/components/ui/qr-ticket";
import { Button } from "@/components/ui/button";
import { PinkShimmerSkeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Printer,
  ArrowLeft,
  Search,
  Hourglass,
} from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const ticketCode = searchParams?.get("code") || "";
  const eventId = searchParams?.get("eventId") || "";
  const isWaitlist = searchParams?.get("waitlist") === "1";

  const [ticket, setTicket] = React.useState<Ticket | null>(null);
  const [lookupFailed, setLookupFailed] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      if (isWaitlist) {
        setLookupFailed(false);
        setIsLoading(false);
        return;
      }
      if (ticketCode) {
        try {
          const t = await api.getTicket(ticketCode);
          setTicket(t);
        } catch {
          setLookupFailed(true);
        }
      } else if (eventId) {
        // No ticket code yet; nothing to display until the user finds their pass.
        setLookupFailed(false);
      }
      setIsLoading(false);
    }
    loadData();
  }, [ticketCode, eventId, isWaitlist]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 space-y-6">
        <PinkShimmerSkeleton className="h-8 w-48 mx-auto rounded-lg" />
        <PinkShimmerSkeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (isWaitlist) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 space-y-8 text-center">
        <div className="space-y-3">
          <div className="w-14 h-14 rounded-full bg-[#FF2D87]/10 border border-[#FF2D87]/40 flex items-center justify-center mx-auto text-[#FF2D87]">
            <Hourglass className="w-8 h-8" />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-[#FF2D87]">
            <Hourglass className="w-3.5 h-3.5" />
            <span>Waitlisted</span>
          </div>

          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            You&apos;re on the Waitlist
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            The event is currently at capacity. We&apos;ve added you to the
            waitlist and will email you the moment a spot opens — no need to
            re-register.
          </p>
        </div>

        <Link href="/">
          <Button variant="white" size="md" className="gap-2 font-bold">
            <ArrowLeft className="w-4 h-4 text-slate-950" />
            <span>Back to Events</span>
          </Button>
        </Link>
      </div>
    );
  }

  if (lookupFailed || !ticket) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 space-y-6 text-center">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Ticket Not Found
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          We couldn't retrieve your ticket for code{" "}
          <code className="text-slate-200">{ticketCode || "(none)"}</code>. If
          you just registered, your ticket is available from the Ticket Lookup
          page using your pass code.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/lookup">
            <Button variant="white" size="md" className="gap-2 font-bold">
              <Search className="w-4 h-4" />
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
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8 text-center print:py-0 print:max-w-none">
      {/* Top Banner Success Indicator */}
      <div className="space-y-3 print:hidden">
        <div className="w-14 h-14 rounded-full bg-emerald-950/80 border border-emerald-800 flex items-center justify-center mx-auto text-emerald-400">
          <CheckCircle2 className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Registration Confirmed</span>
        </div>

        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Your Digital Pass is Ready!
        </h1>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Present this QR pass at the gate for instant check-in on the day.
        </p>
      </div>

      {/* Render QRTicket Component */}
      <div className="relative print:shadow-none">
        <QRTicket ticket={ticket} className="mx-auto relative" />
      </div>

      {/* Printable / Download Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2 print:hidden">
        <Button
          variant="white"
          size="md"
          onClick={handlePrint}
          className="gap-2 font-bold"
        >
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
    </div>
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
