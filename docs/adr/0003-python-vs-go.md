# 0003 — Python for core logic, Go for check-in

**Status**: Accepted

**Context**: One language would be simpler to maintain, but the check-in path has a different performance profile — it runs live at an event door, where cold-start latency and validation speed matter more than anywhere else in the system.

**Decision**: Python for event and registration business logic (CRUD, capacity, email trigger). Go for the check-in service specifically — QR validation, attendee lookup, duplicate-scan prevention, attendance logging.

**Consequences**: Two toolchains to maintain instead of one, but a clean responsibility boundary: Python owns business operations, Go owns check-in. Also demonstrates comfort working across languages, which single-language portfolio projects don't show.
