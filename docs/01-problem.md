# Problem

Event registration via Microsoft Forms + Excel breaks down past a handful of attendees:

- No real capacity control — overbooking happens because nothing locks a seat at the moment of registration
- No de-duplication — the same person can submit the form multiple times
- No check-in mechanism at the door — organizers manually cross-reference a spreadsheet
- No audit trail — no record of who changed what, or when
- No live visibility — organizers don't know registration numbers without opening the sheet

Kaluna replaces this with a serverless REST API and admin dashboard: real-time capacity tracking, QR-based check-in, and a full audit log, running on AWS at near-zero cost for this scale of usage.
