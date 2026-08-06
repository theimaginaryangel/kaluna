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

function getApiUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url || url.trim() === '') {
    return null;
  }
  return url.replace(/\/$/, '');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiUrl();
  if (!baseUrl) {
    throw new Error('NO_API_URL');
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${endpoint}`, {
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
      const endpoint = `/api/events${queryString ? `?${queryString}` : ''}`;

      return await request<Event[]>(endpoint);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      // Fallback to Demo Data
      let results = [...demoStore.events];
      if (params?.category && params.category !== 'All') {
        results = results.filter((e) => e.category === params.category);
      }
      if (params?.query) {
        const q = params.query.toLowerCase();
        results = results.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.description.toLowerCase().includes(q) ||
            e.speaker.name.toLowerCase().includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      if (params?.featured) {
        results = results.filter((e) => e.featured);
      }
      return results;
    }
  },

  /**
   * Fetch single event by slug
   */
  async getEventBySlug(slug: string): Promise<Event> {
    try {
      return await request<Event>(`/api/events/slug/${slug}`);
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
      return await request<Event>(`/api/events/${id}`);
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      const event = demoStore.events.find((e) => e.id === id);
      if (!event) {
        throw new KalunaApiError(`Event with ID '${id}' not found`, 'EVENT_NOT_FOUND', 404);
      }
      return event;
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
        `/api/events/${data.eventId}/register`,
        {
          method: 'POST',
          body: JSON.stringify(data),
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

      if (event.registeredCount >= event.capacity || event.status === 'Sold Out') {
        throw new KalunaApiError(
          `This event is full. Registration closed.`,
          'EVENT_FULL',
          422
        );
      }

      const duplicate = demoStore.registrations.find(
        (r) => r.eventId === data.eventId && r.userEmail.toLowerCase() === data.userEmail.toLowerCase()
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
        registeredCount: event.registeredCount + 1,
        status:
          event.registeredCount + 1 >= event.capacity
            ? ('Sold Out' as const)
            : event.registeredCount + 1 >= event.capacity * 0.8
            ? ('Limited' as const)
            : event.status,
      };
      demoStore.events[eventIndex] = updatedEvent;

      const ticketCode = `KALUNA-${event.category.toUpperCase().slice(0, 3)}-${Math.floor(
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
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        location: event.location,
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
      return await request<Ticket>(`/api/tickets/${ticketCode}`);
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
    const code = ticketCode.trim().toUpperCase();
    try {
      return await request<CheckIn>(`/api/tickets/${code}/check-in`, {
        method: 'POST',
      });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;

      const ticket = demoStore.tickets[code];
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
      return await request<AdminStats>('/api/admin/stats');
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      const totalRegs = demoStore.registrations.length + 320;
      const totalCheckInsCount = demoStore.checkIns.filter((c) => c.status === 'success').length + 180;
      const totalCapacity = demoStore.events.reduce((acc, e) => acc + e.capacity, 0);
      const totalRegistered = demoStore.events.reduce((acc, e) => acc + e.registeredCount, 0);

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
            count: demoStore.events.filter((e) => e.category === 'Tech').length,
            registrations: demoStore.events
              .filter((e) => e.category === 'Tech')
              .reduce((acc, e) => acc + e.registeredCount, 0),
          },
          {
            category: 'Books',
            count: demoStore.events.filter((e) => e.category === 'Books').length,
            registrations: demoStore.events
              .filter((e) => e.category === 'Books')
              .reduce((acc, e) => acc + e.registeredCount, 0),
          },
          {
            category: 'Workshop',
            count: demoStore.events.filter((e) => e.category === 'Workshop').length,
            registrations: demoStore.events
              .filter((e) => e.category === 'Workshop')
              .reduce((acc, e) => acc + e.registeredCount, 0),
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
      return await request<{ token: string; username: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      if (password === 'invalid' || username === 'invalid') {
        throw new KalunaApiError('Invalid credentials', 'UNAUTHORIZED', 401);
      }
      return {
        token: `demo-jwt-token-${Date.now()}`,
        username,
      };
    }
  },

  /**
   * Create new Event (Admin)
   */
  async createEvent(eventData: Partial<Event>): Promise<Event> {
    try {
      return await request<Event>('/api/events', {
        method: 'POST',
        body: JSON.stringify(eventData),
      });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;

      const newEvent: Event = {
        id: `evt-${Date.now()}`,
        title: eventData.title || 'Untitled Event',
        slug: eventData.slug || (eventData.title ? eventData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : `event-${Date.now()}`),
        description: eventData.description || '',
        shortDescription: eventData.shortDescription || eventData.description || '',
        category: eventData.category || 'Tech',
        date: eventData.date || new Date().toISOString().split('T')[0],
        time: eventData.time || '18:00 - 20:00 EST',
        location: eventData.location || 'Kaluna Main Stage',
        speaker: eventData.speaker || { name: 'Kaluna Team', role: 'Host' },
        capacity: Number(eventData.capacity) || 100,
        registeredCount: 0,
        price: Number(eventData.price) || 0,
        imageUrl: eventData.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        tags: eventData.tags || ['Event'],
        featured: eventData.featured || false,
        status: 'Available',
        createdAt: new Date().toISOString(),
      };

      demoStore.events.unshift(newEvent);
      return newEvent;
    }
  },

  /**
   * Update Event (Admin)
   */
  async updateEvent(id: string, eventData: Partial<Event>): Promise<Event> {
    try {
      return await request<Event>(`/api/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(eventData),
      });
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;

      const idx = demoStore.events.findIndex((e) => e.id === id);
      if (idx === -1) {
        throw new KalunaApiError(`Event not found: ${id}`, 'EVENT_NOT_FOUND', 404);
      }

      const existing = demoStore.events[idx];
      const updated: Event = {
        ...existing,
        ...eventData,
        capacity: eventData.capacity !== undefined ? Number(eventData.capacity) : existing.capacity,
        price: eventData.price !== undefined ? Number(eventData.price) : existing.price,
      };

      demoStore.events[idx] = updated;
      return updated;
    }
  },

  /**
   * Get Registrations list (Admin / CSV)
   */
  async getRegistrations(): Promise<Registration[]> {
    try {
      return await request<Registration[]>('/api/admin/registrations');
    } catch (err) {
      if (err instanceof KalunaApiError) throw err;
      return demoStore.registrations;
    }
  },
};

