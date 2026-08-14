"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#090A0F] text-slate-100 flex items-center justify-center px-4 py-24">
      <div className="max-w-lg w-full text-center space-y-8 p-8 sm:p-12 rounded-3xl bg-[#141622] border border-[#272B40] shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-slate-800/40 blur-[90px] rounded-full pointer-events-none" />

        {/* 404 Hero Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono text-slate-400">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>Error Code 404</span>
        </div>

        {/* Large Editorial 404 Header */}
        <div className="space-y-3">
          <h1 className="text-6xl sm:text-7xl font-extrabold font-mono text-white tracking-tighter">
            404
          </h1>
          <h2 className="text-2xl font-bold text-slate-200 tracking-tight">
            Stage Not Found
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm mx-auto">
            This page doesn't exist or has moved.
          </p>
        </div>

        {/* Action Home Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="white"
              size="lg"
              className="w-full sm:w-auto justify-center font-bold gap-2"
            >
              <Home className="w-4 h-4 text-slate-950" />
              <span>Return to Catalog</span>
            </Button>
          </Link>
          <Link href="/lookup" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span>Ticket Lookup</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
