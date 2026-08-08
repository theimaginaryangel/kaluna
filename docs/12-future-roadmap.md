# Future Roadmap

Cut from v1 deliberately, to keep the build shippable. Candidates for future releases:

- **Payments** — paid ticket tiers once a payment gateway is available
- **CQRS / event sourcing** — real architectural depth, but overkill for this scale; noted here as a demonstrated awareness rather than built
- **Multi-organizer support** — organizations owning multiple events with their own admin users

## Shipped Features (v1.1)

- **Waitlist** — auto-promote when a cancellation frees a seat; now fully wired end-to-end: join-waitlist flow on the registration form, waitlist confirmation page, per-event waitlist toggle in the event form, and a waitlisted-attendees view in the dashboard
- **Self-service cancellation** — `/cancel` page plus a "Cancel your registration" link in the confirmation email
- **Dashboard upgrades** — per-event CSV export (previously only exported the first event), live "checked-in / registered" badges, and expandable waitlist lists per event
- **Event reminders** — EventBridge Scheduler + SES, 24h before an event
- **Post-event feedback** — automated survey email after check-in
- **ICS Calendar Invites** — MIME multipart email with RFC 5545 `.ics` file attachment
- **Cognito RBAC** — Creator vs Godmode Admin role-based authorization split
- **Public polish** — live capacity bars on event cards
