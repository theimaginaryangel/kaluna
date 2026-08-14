export type EventCategory = "Tech" | "Books" | "Workshop";

export type EventStatus =
  "Available" | "Limited" | "Sold Out" | "available" | "limited" | "sold_out";

export interface Event {
  id: string;
  eventId?: string;
  name: string;
  title?: string;
  date: string;
  venue?: string;
  location?: string;
  capacity: number;
  seatsRemaining: number;
  status: EventStatus;
  createdAt?: string;
  ownerId?: string;
  waitlistEnabled?: boolean;
  slug?: string;
  imageUrl?: string;
}

export interface Registration {
  id: string;
  registrationId?: string;
  ticketId?: string;
  eventId: string;
  eventTitle?: string;
  userName?: string;
  name?: string;
  userEmail?: string;
  email?: string;
  ticketCode?: string;
  registeredAt: string;
  status:
    | "confirmed"
    | "cancelled"
    | "checked_in"
    | "registered"
    | "waitlisted"
    | "available";
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
  status: "valid" | "used" | "invalid";
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
  status: "success" | "failed" | "already_checked_in";
  note?: string;
}

export type ApiErrorCode =
  | "EVENT_NOT_FOUND"
  | "EVENT_FULL"
  | "DUPLICATE_REGISTRATION"
  | "INVALID_TICKET"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

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
