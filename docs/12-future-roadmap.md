# Future Roadmap

Cut from v1 deliberately, to keep the build shippable. Candidates for future releases:

- **Payments** — paid ticket tiers once a payment gateway is available
- **CQRS / event sourcing** — real architectural depth, but overkill for this scale; noted here as a demonstrated awareness rather than built
- **Multi-organizer support** — organizations owning multiple events with their own admin users
- **CloudFront + custom domain** — once the frontend is live and stable

## Shipped Features (v1.1)

- **Waitlist** — auto-promote when a cancellation frees a seat
- **Event reminders** — EventBridge Scheduler + SES, 24h before an event
- **Post-event feedback** — automated survey email after check-in
