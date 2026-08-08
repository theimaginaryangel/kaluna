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
    ticketCode: payload.ticketCode
      ? String(payload.ticketCode)
      : payload.ticketId
      ? String(payload.ticketId)
      : undefined,
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

export function getCreatorEmail(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return (window.localStorage.getItem('kaluna_creator_email') || '').trim();
}

export function setCreatorEmail(email: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem('kaluna_creator_email', email.trim().toLowerCase());
  window.localStorage.removeItem('kaluna_jwt_token');
  window.localStorage.removeItem('kaluna_admin_user');
}

export function clearCreatorIdentity(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem('kaluna_creator_email');
}

export function isCreatorMode(): boolean {
  return getCreatorEmail() !== '';
}

function creatorScopedEventsPath(suffix: string): string {
  return isCreatorMode() ? `/api/v1/creator/events${suffix}` : `/api/v1/events${suffix}`;
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

  // Password-less creator identity: attach email to creator-scoped endpoints.
  const creatorEmail = getCreatorEmail();
  if (creatorEmail && endpoint.includes('/api/v1/creator/')) {
    headers.set('X-Creator-Email', creatorEmail);
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

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  /**
   * Fetch events list. In creator mode, returns only the creator's own events.
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
      const endpoint = `${creatorScopedEventsPath('')}${queryString ? `?${queryString}` : ''}`;
      const payload = await request<unknown>(endpoint);
      const rawEvents = unwrapListResponse<unknown[]>(payload);

      return (Array.isArray(rawEvents) ? rawEvents : []).map((entry) => normalizeEvent(entry as Record<string, unknown>));
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || 'Failed to load events',
        'INTERNAL_ERROR',
        500
      );
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
      throw new KalunaApiError(
        (err as Error)?.message || `Failed to load event: ${slug}`,
        'INTERNAL_ERROR',
        500
      );
    }
  },

  /**
   * Fetch single event by ID
   */
  async getEventById(id: string): Promise<Event> {
    try {
      const payload = await request<unknown>(creatorScopedEventsPath(`/${id}`));
      return normalizeEvent(payload as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || `Event with ID '${id}' not found`,
        'INTERNAL_ERROR',
        500
      );
    }
  },

  /**
   * Register a user for an event
   */
  async registerForEvent(data: {
    eventId: string;
    userName: string;
    userEmail: string;
  }): Promise<Registration> {
    if (!data.userName || !data.userEmail) {
      throw new KalunaApiError('Name and email are required', 'VALIDATION_ERROR', 400);
    }

    try {
      const payload = await request<Record<string, unknown>>(
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
      return normalizeRegistration(payload);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || 'Registration failed',
        'INTERNAL_ERROR',
        500
      );
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
      const ticketStatus: Ticket['status'] =
        rawStatus === 'checked_in' || rawStatus === 'used'
          ? 'used'
          : rawStatus === 'invalid'
          ? 'invalid'
          : 'valid';

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
      throw new KalunaApiError(
        (err as Error)?.message || `Invalid ticket code: ${ticketCode}`,
        'INVALID_TICKET',
        404
      );
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
      throw new KalunaApiError(
        (err as Error)?.message || `Ticket code '${code}' is invalid`,
        'INVALID_TICKET',
        404
      );
    }
  },

  /**
   * Get Admin dashboard statistics
   */
  async getAdminStats(): Promise<AdminStats> {
    try {
      const payload = await request<unknown>(isCreatorMode() ? '/api/v1/creator/analytics' : '/api/v1/analytics');
      return normalizeAdminStats(payload as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || 'Failed to load analytics',
        'INTERNAL_ERROR',
        500
      );
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
      const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
      const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
      if (!userPoolId || !clientId) {
        throw new KalunaApiError('Cognito is not configured', 'INTERNAL_ERROR', 500);
      }
      const pool = new CognitoUserPool({
        UserPoolId: userPoolId,
        ClientId: clientId,
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
      const created = await request<unknown>(creatorScopedEventsPath(''), {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return normalizeEvent(created as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || 'Failed to create event',
        'INTERNAL_ERROR',
        500
      );
    }
  },

  /**
   * Update Event (Admin)
   */
  async updateEvent(id: string, eventData: Partial<Event>): Promise<Event> {
    const payload = buildEventApiPayload(eventData);

    try {
      const updated = await request<unknown>(creatorScopedEventsPath(`/${id}`), {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      return normalizeEvent(updated as Record<string, unknown>);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || `Failed to update event: ${id}`,
        'INTERNAL_ERROR',
        500
      );
    }
  },

  /**
   * Delete Event (Admin)
   */
  async deleteEvent(id: string): Promise<void> {
    try {
      await request<unknown>(creatorScopedEventsPath(`/${id}`), { method: 'DELETE' });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || `Failed to delete event: ${id}`,
        'INTERNAL_ERROR',
        500
      );
    }
  },

  /**
   * Get check-ins for an event
   */
  async getCheckIns(eventId: string): Promise<{ checkedIn: number; total: number; attendees: Registration[] }> {
    const payload = await request<{ checkedIn: number; total: number; attendees: unknown[] }>(
      creatorScopedEventsPath(`/${encodeURIComponent(eventId)}/check-ins`)
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
    if (!eventId) {
      return [];
    }

    try {
      const payload = await request<unknown>(creatorScopedEventsPath(`/${encodeURIComponent(eventId)}/registrations`));
      const registrations = unwrapListResponse<unknown[]>(payload);
      return (Array.isArray(registrations) ? registrations : []).map((entry) => normalizeRegistration(entry as Record<string, unknown>));
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      throw new KalunaApiError(
        (err as Error)?.message || 'Failed to load registrations',
        'INTERNAL_ERROR',
        500
      );
    }
  },
};

