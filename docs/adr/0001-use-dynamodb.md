# 0001 — Use DynamoDB over RDS

**Status**: Accepted

**Context**: Need a database for events, registrations, and an audit log, accessed almost entirely by known key patterns (get event, list registrations for an event, look up a ticket), running behind Lambda.

**Decision**: DynamoDB, single table.

**Consequences**: No connection pooling problems inside Lambda (a real pain point with RDS + Lambda at scale), scales to zero cost when idle, capacity math done via conditional updates instead of SQL transactions. Trade-off: no ad-hoc SQL querying — access patterns must be designed up front, which is documented in `05-database.md`.
