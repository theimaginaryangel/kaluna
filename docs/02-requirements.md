# Requirements

## Functional

- Public users can browse events and see live availability (Available / Limited / Sold Out)
- Public users can register for an event with name + email; duplicate registrations for the same event/email are rejected
- Registration is capacity-checked and seat-decremented atomically — no overbooking under concurrent requests
- Registration issues a ticket ID and QR code, emailed via SES
- Users can cancel a registration, releasing the seat
- Door staff can scan a QR code to check a ticket in; a second scan of the same ticket is rejected
- Admins (Cognito-authenticated) can create, edit, and delete events
- Admins can view registrations per event, export attendees as CSV, and see live check-in counts
- Every state-changing action is recorded in an audit log

## Non-functional

- Serverless — no idle compute cost
- Runs within AWS Free Tier at portfolio-demo scale
- Infrastructure fully defined in Terraform, no manual console changes
- Deployed via GitHub Actions CI/CD across dev / staging / prod environments
- All Lambda errors and elevated latency trigger CloudWatch alarms
- API responses and errors follow a consistent, documented contract (see `00-engineering-spec.md`)
