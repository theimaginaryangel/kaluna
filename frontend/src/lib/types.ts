export type EventCategory = 'Tech' | 'Books' | 'Workshop';

export type EventStatus = 'Available' | 'Limited' | 'Sold Out';

export interface Event {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: EventCategory;
  date: string;
  time: string;
  location: string;
  virtualUrl?: string;
  speaker: {
    name: string;
    role: string;
    avatarUrl?: string;
  };
  capacity: number;
  registeredCount: number;
  price: number;
  imageUrl: string;
  tags: string[];
  featured?: boolean;
  status: EventStatus;
  createdAt?: string;
}

export interface Registration {
  id: string;
  eventId: string;
  eventTitle?: string;
  userName: string;
  userEmail: string;
  ticketCode: string;
  registeredAt: string;
  status: 'confirmed' | 'cancelled' | 'checked_in';
}

export interface Ticket {
  ticketCode: string;
  registrationId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  location: string;
  userName: string;
  userEmail: string;
  qrValue: string;
  status: 'valid' | 'used' | 'invalid';
  checkedInAt?: string;
}

export interface CheckIn {
  id: string;
  ticketCode: string;
  eventId: string;
  eventTitle: string;
  userName: string;
  userEmail: string;
  timestamp: string;
  status: 'success' | 'failed' | 'already_checked_in';
  note?: string;
}

export type ApiErrorCode =
  | 'EVENT_NOT_FOUND'
  | 'EVENT_FULL'
  | 'DUPLICATE_REGISTRATION'
  | 'INVALID_TICKET'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiError {
  message: string;
  errorCode: ApiErrorCode | string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export interface AdminStats {
  totalEvents: number;
  totalRegistrations: number;
  totalCheckIns: number;
  capacityUtilization: number;
  recentRegistrations: Registration[];
  recentCheckIns: CheckIn[];
  categoryBreakdown: {
    category: EventCategory;
    count: number;
    registrations: number;
  }[];
}
