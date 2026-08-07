# Project: Kaluna Frontend

## Architecture & Overview
- Target location: `d:/New folder (6)/kaluna/kaluna/frontend`
- Framework: Next.js 14+ (App Router)
- Static Export Configuration: `next.config.js` / `next.config.mjs` with `output: 'export'`, `images: { unoptimized: true }` producing `out/` directory.
- Styling & Motion: Tailwind CSS, Framer Motion
- Color Palette: Editorial Black (`#000000` / `#111111`) & White (`#FFFFFF` / `#FAFAFA`).
- Strict Accent Constraint: `#FF2D87` (Hot Pink) ONLY on interactive/motion states (hover, focus, active, ripple, animated fill, shimmer skeleton loader). ZERO `#FF2D87` on static text or static backgrounds.
- Easing:
  - Apple-style Spring Easing for transitions: `cubic-bezier(0.25, 0.1, 0.25, 1)`
  - Material-style Bouncy Elevation for direct interactions: `cubic-bezier(0.34, 1.56, 0.64, 1)`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Setup & Infrastructure | Init Next.js App Router project in `frontend`, configure Tailwind, Framer Motion, `next.config` static export, package.json dependencies | none | IN_PROGRESS |
| 2 | Design System & Core Primitives | Editorial B&W layout, Navbar, Footer, Shimmer Skeleton (Pink), Ripple Button, Spring Reveal, Card Primitives, API Client & Error Handler (`errorCode` parsing) | M1 | PLANNED |
| 3 | Public User Flows (6 pages) | Landing/Listing (filterable), Event Detail, Registration Form (inline validation), Success Page (QR ticket), Ticket Lookup, 404 Page | M2 | PLANNED |
| 4 | Admin UI & Workflows (3 pages) | Admin Login UI (Cognito), Admin Dashboard (live check-in feed, stat cards, capacity bars), Create/Edit Event Form | M2 | PLANNED |
| 5 | Verification, Audit & Hardening | Full build test (`npm run build`), `out/` validation, strict `#FF2D87` static grep audit, API error code handling verification, E2E flow check | M3, M4 | PLANNED |

## Interface Contracts & API Design
- `NEXT_PUBLIC_API_URL` environment variable for all API requests.
- Standard API Error Structure: `{ "error": "...", "errorCode": "EVENT_FULL" | "INVALID_TICKET" | "UNAUTHORIZED" | "VALIDATION_ERROR" | ... }`
- API Client must handle fallback demo content when `NEXT_PUBLIC_API_URL` is not set or network fails, while preserving full API call capabilities and error code handling.

## Code Layout
```
frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx (Landing / Event Listing)
│   ├── events/[id]/page.tsx (Event Detail & Registration)
│   ├── success/page.tsx (Registration Success with QR Ticket)
│   ├── lookup/page.tsx (Ticket Lookup)
│   ├── admin/
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   └── events/[id]/edit/page.tsx (Create / Edit Event)
│   └── not-found.tsx (404 Page)
├── components/
│   ├── ui/ (Button, Input, Skeleton, Card, Modal, Badge, Ripple, QR)
│   ├── layout/ (Navbar, Footer, Shell)
│   └── events/ (EventCard, FilterBar, CheckinFeed, CapacityBar, StatCard)
├── lib/
│   ├── api.ts (NEXT_PUBLIC_API_URL fetch wrapper with errorCode handling)
│   ├── demo-data.ts (Tech, Books, Workshop realistic demo data)
│   └── utils.ts
├── public/
├── tailwind.config.js
└── next.config.mjs (output: 'export')
```
