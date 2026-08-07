'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Event, EventCategory, ApiError } from '@/lib/types';
import { api, KalunaApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Calendar, MapPin, User, Users, DollarSign, Image as ImageIcon, Tag, FileText } from 'lucide-react';

interface EventFormProps {
  initialEvent?: Event;
  isEditMode?: boolean;
}

export function EventForm({ initialEvent, isEditMode = false }: EventFormProps) {
  const router = useRouter();

  const [title, setTitle] = React.useState(initialEvent?.name || initialEvent?.title || '');
  const [category, setCategory] = React.useState<EventCategory>('Tech');
  const [date, setDate] = React.useState(initialEvent?.date || new Date().toISOString().split('T')[0]);
  const [time, setTime] = React.useState('18:00 - 20:00 EST');
  const [location, setLocation] = React.useState(initialEvent?.venue || initialEvent?.location || 'Kaluna Main Stage (Hall A)');
  const [speakerName, setSpeakerName] = React.useState('');
  const [speakerRole, setSpeakerRole] = React.useState('');
  const [capacity, setCapacity] = React.useState<number>(initialEvent?.capacity || 100);
  const [price, setPrice] = React.useState<number>(0);
  const [imageUrl, setImageUrl] = React.useState(initialEvent?.imageUrl || '');
  const [description, setDescription] = React.useState('');
  const [tagsInput, setTagsInput] = React.useState('');

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [apiError, setApiError] = React.useState<ApiError | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!title.trim()) errs.title = 'Event title is required';
    if (!date.trim()) errs.date = 'Event date is required';
    if (!location.trim()) errs.location = 'Venue location is required';
    if (capacity < 1) errs.capacity = 'Capacity must be at least 1 spot';
    if (imageUrl.trim() && !/^https:\/\/\S+$/.test(imageUrl.trim())) {
      errs.imageUrl = 'Banner image must be a valid https URL';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    setIsSubmitting(true);

    const eventPayload: Partial<Event> = {
      name: title.trim(),
      title: title.trim(),
      date,
      venue: location.trim(),
      location: location.trim(),
      capacity: Number(capacity),
      imageUrl: imageUrl.trim(),
    };

    // The current backend contract only stores name/date/venue/capacity/imageUrl.
    // The additional form fields remain in local state for future support.

    try {
      if (isEditMode && initialEvent?.id) {
        await api.updateEvent(initialEvent.id, eventPayload);
      } else {
        await api.createEvent(eventPayload);
      }

      router.push('/admin/dashboard');
    } catch (err: any) {
      if (err instanceof KalunaApiError) {
        setApiError({
          message: err.message,
          errorCode: err.errorCode,
          statusCode: err.statusCode,
        });
      } else {
        setApiError({
          message: err?.message || 'Failed to save event parameters.',
          errorCode: 'INTERNAL_ERROR',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* API Error Banner */}
      {apiError && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-300">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Server Error [{apiError.errorCode}]</span>
          </div>
          <p className="text-rose-300/90 leading-relaxed">{apiError.message}</p>
        </div>
      )}

      {/* Grid: Basic Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="md:col-span-2">
          <Input
            label="Event Title"
            type="text"
            placeholder="e.g. Next-Gen Autonomous AI Agents"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={errors.title}
            disabled={isSubmitting}
          />
        </div>

        {/* Category Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EventCategory)}
            className="flex h-11 w-full rounded-full border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D87]"
            disabled={isSubmitting}
          >
            <option value="Tech">Tech</option>
            <option value="Books">Books</option>
            <option value="Workshop">Workshop</option>
          </select>
        </div>

        {/* Date Field */}
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
          icon={<Calendar className="w-4 h-4" />}
          disabled={isSubmitting}
        />

        {/* Time Field */}
        <Input
          label="Time Window"
          type="text"
          placeholder="e.g. 18:00 - 20:30 EST"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={isSubmitting}
        />

        {/* Location Field */}
        <Input
          label="Location / Venue"
          type="text"
          placeholder="e.g. Kaluna Auditorium A"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          error={errors.location}
          icon={<MapPin className="w-4 h-4" />}
          disabled={isSubmitting}
        />

        {/* Speaker Name */}
        <Input
          label="Speaker Name"
          type="text"
          placeholder="e.g. Dr. Aris Thorne"
          value={speakerName}
          onChange={(e) => setSpeakerName(e.target.value)}
          error={errors.speakerName}
          icon={<User className="w-4 h-4" />}
          disabled={isSubmitting}
        />

        {/* Speaker Role */}
        <Input
          label="Speaker Role / Organization"
          type="text"
          placeholder="e.g. Head of AI, Neural Systems"
          value={speakerRole}
          onChange={(e) => setSpeakerRole(e.target.value)}
          disabled={isSubmitting}
        />

        {/* Capacity */}
        <Input
          label="Venue Capacity (Max Spots)"
          type="number"
          min={1}
          value={capacity}
          onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
          error={errors.capacity}
          icon={<Users className="w-4 h-4" />}
          disabled={isSubmitting}
        />

        {/* Price */}
        <Input
          label="Ticket Price ($ USD, 0 for Free)"
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
          icon={<DollarSign className="w-4 h-4" />}
          disabled={isSubmitting}
        />

        {/* Banner Image URL */}
        <div className="md:col-span-2">
          <Input
            label="Banner Image URL"
            type="url"
            placeholder="https://images.unsplash.com/..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            error={errors.imageUrl}
            icon={<ImageIcon className="w-4 h-4" />}
            disabled={isSubmitting}
          />
        </div>

        {/* Tags */}
        <div className="md:col-span-2">
          <Input
            label="Topic Tags (comma-separated)"
            type="text"
            placeholder="AI, Systems, Workshop"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            icon={<Tag className="w-4 h-4" />}
            disabled={isSubmitting}
          />
        </div>

        {/* Description Textarea */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Event Description
          </label>
          <textarea
            rows={4}
            placeholder="Comprehensive event details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D87]"
            disabled={isSubmitting}
          />
          {errors.description && (
            <p className="text-xs text-rose-500 dark:text-rose-400 font-medium">{errors.description}</p>
          )}
        </div>
      </div>

      {/* Submit Controls */}
      <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
        <Button
          type="button"
          variant="ghost"
          size="md"
          onClick={() => router.push('/admin/dashboard')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="white"
          size="lg"
          isLoading={isSubmitting}
          className="font-bold"
        >
          {isEditMode ? 'Update Event' : 'Create Event'}
        </Button>
      </div>
    </form>
  );
}
