# Database Design

Single DynamoDB table: `KalunaTable`. One system, one set of access patterns.

## Entities

| Entity | PK | SK | Notes |
|---|---|---|---|
| Event | `EVENT#{eventId}` | `METADATA` | name, date, venue, capacity, seatsRemaining, status, createdAt |
| Registration | `EVENT#{eventId}` | `REG#{email}` | registrationId, ticketId, name, status, registeredAt |
| Ticket lookup | `TICKET#{ticketId}` | `METADATA` | GSI1 — reverse lookup, scan → registration in one query |
| Audit log entry | `EVENT#{eventId}` | `AUDIT#{timestamp}` | action, actor, details — immutable, never updated or deleted |

## Access patterns

| Need | Query |
|---|---|
| List an event's details | `GetItem(PK=EVENT#{id}, SK=METADATA)` |
| List all registrations for an event | `Query(PK=EVENT#{id}, SK begins_with REG#)` |
| Look up a registration by scanned QR (ticketId) | `Query on GSI1 (PK=TICKET#{ticketId})` |
| Event's audit trail | `Query(PK=EVENT#{id}, SK begins_with AUDIT#)`, sorted naturally by timestamp |

## Concurrency control

Seat decrement on registration is a conditional update:
```
UpdateItem(
  Key: EVENT#{id}/METADATA,
  UpdateExpression: "SET seatsRemaining = seatsRemaining - :one",
  ConditionExpression: "seatsRemaining > :zero"
)
```
If the condition fails, the API returns `409 EVENT_FULL`. This is what prevents overbooking under concurrent registrations without needing a lock or a queue.

## Audit log

Every state-changing action writes an `AUDIT#` item in the same transaction where practical: event created/edited/deleted, registration created/cancelled, ticket checked in, duplicate scan blocked. This is what powers the "recent activity" feed on the admin dashboard, and it's a genuine audit trail, not just log lines that expire.
