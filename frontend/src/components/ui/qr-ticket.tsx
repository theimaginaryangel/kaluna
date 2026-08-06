'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, MapPin, User, CheckCircle2, AlertCircle, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QRTicketProps {
  ticket: Ticket;
  className?: string;
  size?: number;
}

export function QRTicket({ ticket, className, size = 180 }: QRTicketProps) {
  const [copied, setCopied] = React.useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(ticket.ticketCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isUsed = ticket.status === 'used';
  const isValid = ticket.status === 'valid';

  return (
    <div
      className={cn(
        'relative bg-[#141622] border border-[#272B40] rounded-2xl overflow-hidden shadow-2xl p-6 flex flex-col items-center gap-5 max-w-md mx-auto',
        'transition-all duration-300 hover:border-[#FF2D87]/80 hover:shadow-[0_0_30px_rgba(255,45,135,0.2)]',
        className
      )}
    >
      {/* Top Header Badge */}
      <div className="w-full flex items-center justify-between border-b border-[#272B40] pb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
            Pass Code
          </span>
          <span className="font-mono font-bold text-sm text-white">
            {ticket.ticketCode}
          </span>
        </div>

        <Badge
          variant={isValid ? 'available' : isUsed ? 'soldOut' : 'limited'}
          className="uppercase tracking-wider"
        >
          {ticket.status}
        </Badge>
      </div>

      {/* QR Code Canvas Frame */}
      <div className="relative p-4 bg-white rounded-xl shadow-inner flex items-center justify-center border-2 border-slate-200">
        <QRCodeSVG
          value={ticket.qrValue || ticket.ticketCode}
          size={size}
          bgColor="#FFFFFF"
          fgColor="#090A0F"
          level="H"
          includeMargin={false}
        />
        {isUsed && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center text-rose-400 font-bold uppercase tracking-wider text-sm gap-1">
            <CheckCircle2 className="w-8 h-8 text-rose-400" />
            <span>TICKET USED</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="w-full space-y-3 text-left bg-[#090A0F] p-4 rounded-xl border border-[#272B40]/70">
        <h4 className="font-bold text-white text-base leading-snug line-clamp-2">
          {ticket.eventTitle}
        </h4>

        <div className="space-y-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {ticket.eventDate} ({ticket.eventTime})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{ticket.location}</span>
          </div>

          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              {ticket.userName} ({ticket.userEmail})
            </span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="w-full flex items-center justify-between gap-3 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={copyCode}
          className="w-full flex items-center justify-center gap-2 text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied Code!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Copy Code</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
