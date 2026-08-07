import {
  Event,
  EventCategory,
  Registration,
  Ticket,
  CheckIn,
  AdminStats,
  ApiError,
  ApiErrorCode,
} from './types';
import { AuthenticationDetails, CognitoUser, CognitoUserPool } from 'amazon-cognito-identity-js';
import {
  DEMO_EVENTS,
  DEMO_REGISTRATIONS,
  DEMO_TICKETS,
  DEMO_CHECKINS,
  DEMO_ADMIN_STATS,
} from './demo-data';

export class KalunaApiError extends Error implements ApiError {
  errorCode: ApiErrorCode | string;
  statusCode?: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    errorCode: ApiErrorCode | string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'KalunaApiError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// In-memory local fallback store for stateful interactive demo mode
const demoStore = {
  events: [...DEMO_EVENTS],
  registrations: [...DEMO_REGISTRATIONS],
  tickets: { ...DEMO_TICKETS },
  checkIns: [...DEMO_CHECKINS],
};

function normalizeEventStatus(status?: string): Event['status'] {
  switch (status?.toLowerCase()) {
    case 'limited':
      return 'Limited';
    case 'sold_out':
      return 'Sold Out';
    case 'available':
    default:
      return 'Available';
  }
}

function normalizeEvent(payload: Record<string, unknown>): Event {
  const eventId = String(payload.eventId || payload.id || '').trim();
  const capacity = Number(payload.capacity ?? 0);
  const seatsRemaining = Number(payload.seatsRemaining ?? payload.capacity ?? 0);

  return {
    id: eventId,
    eventId,
    name: String(payload.name || payload.title || '').trim(),
    title: String(payload.name || payload.title || '').trim(),
    date: String(payload.date || '').trim(),
    venue: String(payload.venue || payload.location || '').trim(),
    location: String(payload.venue || payload.location || '').trim(),
    capacity: Number.isFinite(capacity) ? capacity : 0,
    seatsRemaining: Number.isFinite(seatsRemaining) ? seatsRemaining : 0,
    status: normalizeEventStatus(String(payload.status || '')),
    createdAt: payload.createdAt ? String(payload.createdAt) : undefined,
    ownerId: payload.ownerId ? String(payload.ownerId) : undefined,
    waitlistEnabled: Boolean(payload.waitlistEnabled),
    slug: payload.slug ? String(payload.slug) : undefined,
    imageUrl: payload.imageUrl ? String(payload.imageUrl) : undefined,
  };
}

function normalizeRegistration(payload: Record<string, unknown>): Registration {
  const eventId = String(payload.eventId || '').trim();
  const userName = String(payload.userName || payload.name || '').trim();
  const userEmail = String(payload.userEmail || payload.email || '').trim();

  return {
    id: String(payload.id || payload.registrationId || '').trim(),
    registrationId: payload.registrationId ? String(payload.registrationId) : undefined,
    ticketId: payload.ticketId ? String(payload.ticketId) : undefined,
    eventId,
    eventTitle: payload.eventTitle ? String(payload.eventTitle) : undefined,
    userName,
    name: userName,
    userEmail,
    email: userEmail,
    ticketCode: payload.ticketCode ? String(payload.ticketCode) : undefined,
    registeredAt: String(payload.registeredAt || ''),
    status: (payload.status as Registration['status']) || 'registered',
  };
}

function normalizeAdminStats(payload: Record<string, unknown>): AdminStats {
  const totalRegistrations = Number(payload.totalRegistrations ?? 0);
  const totalEvents = Number(payload.totalEvents ?? 0);
  const attendanceRate = Number(payload.attendanceRate ?? 0);
  const totalCheckIns = Math.max(0, Math.round((totalRegistrations * attendanceRate) / 100));

  return {
    totalEvents,
    totalRegistrations,
    totalCheckIns,
    capacityUtilization: totalEvents > 0 ? Math.min(100, Math.round((totalRegistrations / totalEvents) * 100)) : 0,
    recentRegistrations: [],
    recentCheckIns: [],
    categoryBreakdown: [],
  };
}

function getApiUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url.trim() === '') {
    return null;
  }
  return url.replace(/\/$/, '');
}

function unwrapListResponse<T>(payload: unknown): T {
  // The deployed API currently returns list payloads as { events: [...] } even though
  // the OpenAPI contract documents a bare array. Unwrap defensively so the frontend
  // matches the live service without changing the backend or spec.
  if (Array.isArray(payload)) {
    return payload as T;
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidate = record.events ?? record.registrations ?? record.items ?? record.checkIns;
    if (Array.isArray(candidate)) {
      return candidate as T;
    }
  }

  return payload as T;
}

function normalizeEventDate(value: string | undefined): string {
  if (!value) {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  const isoMatch = /^\d{4}-\d{2}-\d{2}$/.exec(trimmed);
  if (isoMatch) {
    return trimmed;
  }

  const slashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const [, month, day, year] = slashMatch;
    const parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().split('T')[0];
    }
  }

  return trimmed;
}

function buildEventApiPayload(eventData: Partial<Event>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  const name = (eventData.name || eventData.title || '').trim();
  if (name) {
    payload.name = name;
  }

  const normalizedDate = normalizeEventDate(eventData.date);
  if (normalizedDate) {
    payload.date = normalizedDate;
  }

  const venue = (eventData.venue || eventData.location || '').trim();
  if (venue) {
    payload.venue = venue;
  }

  const capacity = Number(eventData.capacity);
  if (Number.isFinite(capacity) && capacity > 0) {
    payload.capacity = capacity;
  }

  if (eventData.imageUrl !== undefined) {
    payload.imageUrl = eventData.imageUrl.trim();
  }

  return payload;
}

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  const token = window.localStorage.getItem('kaluna_jwt_token');
  if (!token || token.trim() === '') {
    return {};
  }

  return { Authorization: `Bearer ${token}` };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error('NO_API_URL');
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  });

  const authHeader = getAuthHeader();
  if (!headers.has('Authorization') && authHeader.Authorization) {
    headers.set('Authorization', authHeader.Authorization);
  }

  const response = await fetch(new URL(endpoint, baseUrl).toString(), {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch {
      // response wasn't JSON
    }

    const message = errorData.message || `Request failed with status ${response.status}`;
    let errorCode: ApiErrorCode | string = errorData.errorCode || errorData.code;

    if (!errorCode) {
      switch (response.status) {
        case 404:
          errorCode = 'EVENT_NOT_FOUND';
          break;
        case 409:
          errorCode = 'DUPLICATE_REGISTRATION';
          break;
        case 400:
          errorCode = 'VALIDATION_ERROR';
          break;
        case 401:
        case 403:
          errorCode = 'UNAUTHORIZED';
          break;
        case 422:
          errorCode = 'EVENT_FULL';
          break;
        default:
          errorCode = 'INTERNAL_ERROR';
      }
    }

    throw new KalunaApiError(message, errorCode, response.status, errorData.details);
  }

  return response.json();
}

export const api = {
  /**
   * Fetch events list with optional category filter, search query, or featured flag.
   */
  async getEvents(params?: {
    category?: EventCategory | 'All';
    query?: string;
    featured?: boolean;
  }): Promise<Event[]> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.category && params.category !== 'All') {
        searchParams.append('category', params.category);
      }
      if (params?.query) {
        searchParams.append('q', params.query);
      }
      if (params?.featured) {
        searchParams.append('featured', 'true');
      }

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/events${queryString ? `?${queryString}` : ''}`;
      const payload = await request<unknown>(endpoint);
      const rawEvents = unwrapListResponse<unknown[]>(payload);

      return (Array.isArray(rawEvents) ? rawEvents : []).map((entry) => normalizeEvent(entry as Record<string, unknown>));
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      // Fallback to Demo Data
      let results = [...demoStore.events];
      if (params?.category && params.category !== 'All') {
        results = results.filter((e) => (e as unknown as { category?: EventCategory }).category === params.category);
      }
      if (params?.query) {
        const q = params.query.toLowerCase();
        results = results.filter((e) => {
          const title = (e as unknown as { title?: string }).title || e.name || '';
          const description = (e as unknown as { description?: string }).description || '';
          const speakerName = (e as unknown as { speaker?: { name?: string } }).speaker?.name || '';
          const tags = (e as unknown as { tags?: string[] }).tags || [];
          return title.toLowerCase().includes(q) || description.toLowerCase().includes(q) || speakerName.toLowerCase().includes(q) || tags.some((t) => t.toLowerCase().includes(q));
        });
      }
      if (params?.featured) {
        results = results.filter((e) => Boolean((e as unknown as { featured?: boolean }).featured));
      }
      return results.map((event) => normalizeEvent(event as unknown as Record<string, unknown>));
    }
  },

  /**
   * Fetch single event by slug
   */
  async getEventBySlug(slug: string): Promise<Event> {
    try {
      const events = await this.getEvents();
      const event = events.find((entry) => entry.slug === slug || entry.id === slug);
      if (!event) {
        throw new KalunaApiError(`Event not found: ${slug}`, 'EVENT_NOT_FOUND', 404);
      }
      return event;
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      const event = demoStore.events.find((e) => e.slug === slug || e.id === slug);
      if (!event) {
        throw new KalunaApiError(`Event not found: ${slug}`, 'EVENT_NOT_FOUND', 404);
      }
      return event;
    }
  },

  /**
   * Fetch single event by ID
   */
  async getEventById(id: string): Promise<Event> {
    try {
      const payload = await request<unknown>(`/api/v1/events/${id}`);
      return normalizeEvent(payload as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      const event = demoStore.events.find((e) => e.id === id);
      if (!event) {
        throw new KalunaApiError(`Event with ID '${id}' not found`, 'EVENT_NOT_FOUND', 404);
      }
      return normalizeEvent(event as unknown as Record<string, unknown>);
    }
  },

  /**
   * Register a user for an event
   */
  async registerForEvent(data: {
    eventId: string;
    userName: string;
    userEmail: string;
  }): Promise<{ registration: Registration; ticket: Ticket }> {
    if (!data.userName || !data.userEmail) {
      throw new KalunaApiError('Name and email are required', 'VALIDATION_ERROR', 400);
    }

    try {
      return await request<{ registration: Registration; ticket: Ticket }>(
        `/api/v1/events/${data.eventId}/register`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: data.userName,
            email: data.userEmail,
            idempotencyKey: `${data.eventId}:${data.userEmail}:${Date.now()}`,
          }),
        }
      );
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;

      // Fallback logic
      const eventIndex = demoStore.events.findIndex((e) => e.id === data.eventId);
      if (eventIndex === -1) {
        throw new KalunaApiError(`Event not found`, 'EVENT_NOT_FOUND', 404);
      }

      const event = demoStore.events[eventIndex];
      const registeredCount = Number((event as unknown as { registeredCount?: number }).registeredCount ?? 0);

      if (registeredCount >= event.capacity || event.status === 'Sold Out') {
        throw new KalunaApiError(
          `This event is full. Registration closed.`,
          'EVENT_FULL',
          422
        );
      }

      const duplicate = demoStore.registrations.find(
        (r) => r.eventId === data.eventId && (r.userEmail || '').toLowerCase() === data.userEmail.toLowerCase()
      );
      if (duplicate) {
        throw new KalunaApiError(
          `You have already registered for this event with email ${data.userEmail}`,
          'DUPLICATE_REGISTRATION',
          409
        );
      }

      // Increment registration count
      const updatedEvent = {
        ...event,
        registeredCount: registeredCount + 1,
        status:
          registeredCount + 1 >= event.capacity
            ? ('Sold Out' as const)
            : registeredCount + 1 >= event.capacity * 0.8
            ? ('Limited' as const)
            : event.status,
      };
      demoStore.events[eventIndex] = updatedEvent;

      const ticketCode = `KALUNA-${String((event as unknown as { category?: string }).category || 'EVT').slice(0, 3).toUpperCase()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const registration: Registration = {
        id: `reg-${Date.now()}`,
        eventId: event.id,
        eventTitle: event.title,
        userName: data.userName,
        userEmail: data.userEmail,
        ticketCode,
        registeredAt: new Date().toISOString(),
        status: 'confirmed',
      };

      const ticket: Ticket = {
        ticketCode,
        registrationId: registration.id,
        eventId: event.id,
        eventTitle: event.title || event.name || 'Event',
        eventDate: event.date,
        eventTime: '18:00 EST',
        location: event.location || event.venue || 'Kaluna Event Center',
        userName: data.userName,
        userEmail: data.userEmail,
        qrValue: `${ticketCode}:${event.id}:${data.userEmail}`,
        status: 'valid',
      };

      demoStore.registrations.push(registration);
      demoStore.tickets[ticketCode] = ticket;

      return { registration, ticket };
    }
  },

  /**
   * Lookup ticket by code
   */
  async getTicket(ticketCode: string): Promise<Ticket> {
    try {
      // API returns a bare registration record — no joined event fields.
      // Fetch the event separately to populate eventTitle, eventDate, location.
      const reg = await request<Record<string, unknown>>(`/api/v1/registrations/${encodeURIComponent(ticketCode)}`);

      const ticketId = String(reg.ticketId || ticketCode);
      const eventId = String(reg.eventId || '');
      const userName = String(reg.name || reg.userName || '');
      const userEmail = String(reg.email || reg.userEmail || '');
      const rawStatus = String(reg.status || 'registered');
      const ticketStatus: Ticket['status'] = rawStatus === 'used' ? 'used' : rawStatus === 'invalid' ? 'invalid' : 'valid';

      let eventTitle = '';
      let eventDate = '';
      let location = '';

      if (eventId) {
        try {
          const event = await request<Record<string, unknown>>(`/api/v1/events/${eventId}`);
          eventTitle = String(event.name || event.title || '');
          eventDate = String(event.date || '');
          location = String(event.venue || event.location || '');
        } catch {
          // event fetch failed — leave fields empty rather than crash
        }
      }

      return {
        ticketCode: ticketId,
        registrationId: String(reg.registrationId || ''),
        eventId,
        eventTitle,
        eventDate,
        eventTime: '',
        location,
        userName,
        userEmail,
        qrValue: `${ticketId}:${eventId}:${userEmail}`,
        status: ticketStatus,
        checkedInAt: reg.checkedInAt ? String(reg.checkedInAt) : undefined,
      };
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      const ticket = demoStore.tickets[ticketCode.trim().toUpperCase()];
      if (!ticket) {
        throw new KalunaApiError(`Invalid ticket code: ${ticketCode}`, 'INVALID_TICKET', 404);
      }
      return ticket;
    }
  },

  /**
   * Check in a ticket by code
   */
  async checkInTicket(ticketCode: string): Promise<CheckIn> {
    const code = ticketCode.trim();
    try {
      return await request<CheckIn>('/api/v1/check-in', {
        method: 'POST',
        body: JSON.stringify({ ticketId: code }),
      });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;

      const ticket = demoStore.tickets[code] || demoStore.tickets[code.toUpperCase()];
      const timestamp = new Date().toISOString();

      if (!ticket) {
        const failedCheckIn: CheckIn = {
          id: `chk-${Date.now()}`,
          ticketCode: code,
          eventId: 'unknown',
          eventTitle: 'Unknown Event',
          userName: 'Unknown',
          userEmail: 'unknown@example.com',
          timestamp,
          status: 'failed',
          note: 'Invalid ticket code',
        };
        demoStore.checkIns.unshift(failedCheckIn);
        throw new KalunaApiError(`Ticket code '${code}' is invalid`, 'INVALID_TICKET', 404);
      }

      if (ticket.status === 'used') {
        const dupCheckIn: CheckIn = {
          id: `chk-${Date.now()}`,
          ticketCode: code,
          eventId: ticket.eventId,
          eventTitle: ticket.eventTitle,
          userName: ticket.userName,
          userEmail: ticket.userEmail,
          timestamp,
          status: 'already_checked_in',
          note: `Already checked in at ${ticket.checkedInAt || 'prior time'}`,
        };
        demoStore.checkIns.unshift(dupCheckIn);
        throw new KalunaApiError(
          `Ticket ${code} has already been checked in`,
          'INVALID_TICKET',
          400,
          { checkIn: dupCheckIn }
        );
      }

      // Mark used
      ticket.status = 'used';
      ticket.checkedInAt = timestamp;

      const successCheckIn: CheckIn = {
        id: `chk-${Date.now()}`,
        ticketCode: code,
        eventId: ticket.eventId,
        eventTitle: ticket.eventTitle,
        userName: ticket.userName,
        userEmail: ticket.userEmail,
        timestamp,
        status: 'success',
        note: 'Check-in successful',
      };
      demoStore.checkIns.unshift(successCheckIn);

      return successCheckIn;
    }
  },

  /**
   * Get Admin dashboard statistics
   */
  async getAdminStats(): Promise<AdminStats> {
    try {
      const payload = await request<unknown>('/api/v1/analytics');
      return normalizeAdminStats(payload as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      const totalRegs = demoStore.registrations.length + 320;
      const totalCheckInsCount = demoStore.checkIns.filter((c) => c.status === 'success').length + 180;
      const totalCapacity = demoStore.events.reduce((acc, e) => acc + e.capacity, 0);
      const totalRegistered = demoStore.events.reduce((acc, e) => acc + Number((e as unknown as { registeredCount?: number }).registeredCount ?? 0), 0);

      return {
        totalEvents: demoStore.events.length,
        totalRegistrations: totalRegs,
        totalCheckIns: totalCheckInsCount,
        capacityUtilization: Math.round((totalRegistered / (totalCapacity || 1)) * 100),
        recentRegistrations: [...demoStore.registrations].reverse().slice(0, 10),
        recentCheckIns: [...demoStore.checkIns].slice(0, 10),
        categoryBreakdown: [
          {
            category: 'Tech',
            count: demoStore.events.filter((e) => (e as unknown as { category?: EventCategory }).category === 'Tech').length,
            registrations: demoStore.events
              .filter((e) => (e as unknown as { category?: EventCategory }).category === 'Tech')
              .reduce((acc, e) => acc + Number((e as unknown as { registeredCount?: number }).registeredCount ?? 0), 0),
          },
          {
            category: 'Books',
            count: demoStore.events.filter((e) => (e as unknown as { category?: EventCategory }).category === 'Books').length,
            registrations: demoStore.events
              .filter((e) => (e as unknown as { category?: EventCategory }).category === 'Books')
              .reduce((acc, e) => acc + Number((e as unknown as { registeredCount?: number }).registeredCount ?? 0), 0),
          },
          {
            category: 'Workshop',
            count: demoStore.events.filter((e) => (e as unknown as { category?: EventCategory }).category === 'Workshop').length,
            registrations: demoStore.events
              .filter((e) => (e as unknown as { category?: EventCategory }).category === 'Workshop')
              .reduce((acc, e) => acc + Number((e as unknown as { registeredCount?: number }).registeredCount ?? 0), 0),
          },
        ],
      };
    }
  },

  /**
   * Admin Login (Cognito / JWT)
   */
  async login(username: string, password: string): Promise<{ token: string; username: string }> {
    if (!username || !password) {
      throw new KalunaApiError('Username and password are required', 'VALIDATION_ERROR', 400);
    }

    try {
      const pool = new CognitoUserPool({
        UserPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || 'us-east-1_60NhNgHlz',
        ClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || '481citp6rarsut793ekot3mjls',
      });

      const user = new CognitoUser({
        Username: username,
        Pool: pool,
      });

      user.setAuthenticationFlowType('USER_PASSWORD_AUTH');

      const authenticationDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      return await new Promise<{ token: string; username: string }>((resolve, reject) => {
        user.authenticateUser(authenticationDetails, {
          onSuccess: (result) => {
            resolve({
              token: result.getIdToken().getJwtToken(),
              username,
            });
          },
          onFailure: (err) => {
            reject(new KalunaApiError(err.message || 'Invalid credentials', 'UNAUTHORIZED', 401));
          },
          newPasswordRequired: () => {
            reject(new KalunaApiError('A new password is required', 'UNAUTHORIZED', 401));
          },
        });
      });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || 'Authentication failed',
        'UNAUTHORIZED',
        401
      );
    }
  },

  /**
   * Create new Event (Admin)
   */
  async createEvent(eventData: Partial<Event>): Promise<Event> {
    const payload = buildEventApiPayload(eventData);

    try {
      const created = await request<unknown>('/api/v1/events', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return normalizeEvent(created as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;

      const newEvent: Event = {
        id: `evt-${Date.now()}`,
        eventId: `evt-${Date.now()}`,
        name: eventData.name || eventData.title || 'Untitled Event',
        title: eventData.name || eventData.title || 'Untitled Event',
        date: eventData.date || new Date().toISOString().split('T')[0],
        venue: eventData.venue || eventData.location || 'Kaluna Main Stage',
        location: eventData.venue || eventData.location || 'Kaluna Main Stage',
        capacity: Number(eventData.capacity) || 100,
        seatsRemaining: Number(eventData.capacity) || 100,
        status: 'Available',
        createdAt: new Date().toISOString(),
      };

      demoStore.events.unshift(newEvent as unknown as (typeof demoStore.events)[number]);
      return newEvent;
    }
  },

  /**
   * Update Event (Admin)
   */
  async updateEvent(id: string, eventData: Partial<Event>): Promise<Event> {
    const payload = buildEventApiPayload(eventData);

    try {
      const updated = await request<unknown>(`/api/v1/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return normalizeEvent(updated as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;

      const idx = demoStore.events.findIndex((e) => e.id === id);
      if (idx === -1) {
        throw new KalunaApiError(`Event not found: ${id}`, 'EVENT_NOT_FOUND', 404);
      }

      const existing = demoStore.events[idx];
      const updated: Event = {
        ...normalizeEvent(existing as unknown as Record<string, unknown>),
        id,
        eventId: id,
        name: eventData.name || eventData.title || existing.title || existing.name || '',
        title: eventData.name || eventData.title || existing.title || existing.name || '',
        date: eventData.date || existing.date,
        venue: eventData.venue || eventData.location || existing.location || existing.venue || '',
        location: eventData.venue || eventData.location || existing.location || existing.venue || '',
        capacity: eventData.capacity !== undefined ? Number(eventData.capacity) : existing.capacity,
        seatsRemaining: eventData.capacity !== undefined ? Number(eventData.capacity) : existing.capacity,
      };

      demoStore.events[idx] = updated as unknown as (typeof demoStore.events)[number];
      return updated;
    }
  },

  /**
   * Delete Event (Admin)
   */
  async deleteEvent(id: string): Promise<void> {
    try {
      await request<unknown>(`/api/v1/events/${id}`, { method: 'DELETE' });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      const idx = demoStore.events.findIndex((e) => e.id === id);
      if (idx !== -1) demoStore.events.splice(idx, 1);
    }
  },

  /**
   * Get check-ins for an event
   */
  async getCheckIns(eventId: string): Promise<{ checkedIn: number; total: number; attendees: Registration[] }> {
    const payload = await request<{ checkedIn: number; total: number; attendees: unknown[] }>(
      `/api/v1/events/${encodeURIComponent(eventId)}/check-ins`
    );
    return {
      checkedIn: payload.checkedIn,
      total: payload.total,
      attendees: (payload.attendees || []).map((a) => normalizeRegistration(a as Record<string, unknown>)),
    };
  },

  /**
   * Get Registrations list (Admin / CSV)
   */
  async getRegistrations(eventId?: string): Promise<Registration[]> {
    const targetEventId = eventId || demoStore.events[0]?.id;

    if (!targetEventId) {
      return [];
    }

    try {
      const payload = await request<unknown>(`/api/v1/events/${encodeURIComponent(targetEventId)}/registrations`);
      const registrations = unwrapListResponse<unknown[]>(payload);
      return (Array.isArray(registrations) ? registrations : []).map((entry) => normalizeRegistration(entry as Record<string, unknown>));
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      return demoStore.registrations.filter((registration) => registration.eventId === targetEventId);
    }
  },
};

