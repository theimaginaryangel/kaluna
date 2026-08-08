'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Event, ApiError } from '@/lib/types';
import { api, KalunaApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, Ticket as TicketIcon, User, Mail } from 'lucide-react';

interface RegistrationFormProps {
  event: Event;
  onSuccess?: (ticketCode: string) => void;
}

export function RegistrationForm({ event, onSuccess }: RegistrationFormProps) {
  const router = useRouter();

  const [userName, setUserName] = React.useState('');
  const [userEmail, setUserEmail] = React.useState('');
  const [ticketsCount, setTicketsCount] = React.useState(1);

  const [userNameError, setUserNameError] = React.useState('');
  const [userEmailError, setUserEmailError] = React.useState('');
  const [ticketsCountError, setTicketsCountError] = React.useState('');

  const [apiError, setApiError] = React.useState<ApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const remainingSpots = Math.max(0, event.seatsRemaining);

  const validateForm = (): boolean => {
    let valid = true;

    if (!userName.trim() || userName.trim().length < 2) {
      setUserNameError('Please enter your full name (minimum 2 characters)');
      valid = false;
    } else {
      setUserNameError('');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!userEmail.trim()) {
      setUserEmailError('Email address is required');
      valid = false;
    } else if (!emailRegex.test(userEmail.trim())) {
      setUserEmailError('Please enter a valid email address');
      valid = false;
    } else {
      setUserEmailError('');
    }

    if (ticketsCount !== 1) {
      setTicketsCountError('Only 1 ticket per registration is allowed');
      valid = false;
    } else {
      setTicketsCountError('');
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await api.registerForEvent({
        eventId: event.id || event.eventId || '',
        userName: userName.trim(),
        userEmail: userEmail.trim(),
      });

      const passCode = result.ticketCode || result.ticketId || '';

      if (onSuccess) {
        onSuccess(passCode);
      }

      const queryParams = new URLSearchParams({
        code: passCode,
        eventId: event.id || event.eventId || '',
      });

      router.push(`/success/?${queryParams.toString()}`);
    } catch (err: any) {
      if (err instanceof KalunaApiError) {
        setApiError({
          message: err.message,
          errorCode: err.errorCode,
          statusCode: err.statusCode,
          details: err.details,
        });
      } else {
        setApiError({
          message: err?.message || 'An unexpected error occurred during registration.',
          errorCode: 'INTERNAL_ERROR',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseErrorCodeMessage = (code: string | undefined): string => {
    switch (code) {
      case 'EVENT_FULL':
        return 'This event has reached maximum capacity. No more registrations are accepted.';
      case 'DUPLICATE_REGISTRATION':
        return `You have already registered for "${event.name || event.title}" with email address ${userEmail}. Check your inbox or pass lookup.`;
      case 'VALIDATION_ERROR':
        return 'Invalid form data provided. Please check all fields and try again.';
      case 'EVENT_NOT_FOUND':
        return 'The requested event could not be located in our system.';
      case 'UNAUTHORIZED':
        return 'Session expired or unauthorized request.';
      default:
        return apiError?.message || 'Failed to complete registration. Please try again.';
    }
  };

  const isSoldOut = event.status === 'Sold Out' || remainingSpots <= 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* API Error Banner */}
      {apiError && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs sm:text-sm space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Registration Error [{apiError.errorCode}]</span>
          </div>
          <p className="text-rose-300/90 leading-relaxed">
            {parseErrorCodeMessage(apiError.errorCode as string)}
          </p>
        </div>
      )}

      {/* Name Input */}
      <Input
        label="Full Name"
        type="text"
        placeholder="e.g. Alexandra Vance"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        error={userNameError}
        icon={<User className="w-4 h-4" />}
        disabled={isSubmitting || isSoldOut}
      />

      {/* Email Input */}
      <Input
        label="Email Address"
        type="email"
        placeholder="e.g. alexandra@example.com"
        value={userEmail}
        onChange={(e) => setUserEmail(e.target.value)}
        error={userEmailError}
        helperText="Your digital QR pass code will be linked to this email."
        icon={<Mail className="w-4 h-4" />}
        disabled={isSubmitting || isSoldOut}
      />

      {/* Note: Ticket quantity is enforced to 1 per person on the backend */}

      {/* Form Submit Action */}
      <div className="pt-3">
        <Button
          type="submit"
          variant="white"
          size="lg"
          className="w-full justify-center font-bold"
          isLoading={isSubmitting}
          disabled={isSoldOut}
        >
          {isSoldOut ? 'Event Sold Out' : 'Confirm Registration'}
        </Button>
      </div>
    </form>
  );
}
