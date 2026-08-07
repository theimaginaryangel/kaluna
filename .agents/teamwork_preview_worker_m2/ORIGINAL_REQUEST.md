## 2026-08-06T13:53:13Z
<USER_REQUEST>
You are teamwork_preview_worker_m2 operating in `.agents/teamwork_preview_worker_m2`.
Your working directory for metadata: `d:\New folder (6)\kaluna\kaluna\.agents\teamwork_preview_worker_m2`
Frontend Target Directory: `d:\New folder (6)\kaluna\kaluna\frontend`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

OBJECTIVE:
Execute Milestone 2: Build Design System, Core Interactive UI Components, API Client & Error Handler, TypeScript Types, Demo Data, and Layout Shell in `d:\New folder (6)\kaluna\kaluna\frontend`.

SPECIFICATIONS TO FOLLOW:
- `#FF2D87` (Hot Pink) accent color MUST NOT be used on static text or static background fills! Strictly reserved for interactive/motion states (hover, focus-visible outline/ring, active, ripples, animated fills, pink shimmer loading skeleton).
- Easing specifications:
  - Apple spring easing (`cubic-bezier(0.25, 0.1, 0.25, 1)`) for transitions and reveals.
  - Material bouncy easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) for direct interactions (buttons, card elevation, ripples).

TASKS:
1. Create `src/lib/types.ts`: Define `Event`, `EventCategory` ('Tech' | 'Books' | 'Workshop'), `Registration`, `Ticket`, `CheckIn`, `ApiError` (with `errorCode` field), `AdminStats`.
2. Create `src/lib/demo-data.ts`: High-quality realistic demo events for Tech, Books, and Workshop categories with full details, capacity, images, dates, tags, and sample check-in logs.
3. Create `src/lib/api.ts`: Centralized API Client reading `NEXT_PUBLIC_API_URL`. Parse `errorCode` from API responses (`EVENT_NOT_FOUND`, `EVENT_FULL`, `DUPLICATE_REGISTRATION`, `INVALID_TICKET`, `UNAUTHORIZED`, `VALIDATION_ERROR`, `INTERNAL_ERROR`). Fall back seamlessly to demo data when `NEXT_PUBLIC_API_URL` is unconfigured or network requests fail.
4. Create `src/lib/utils.ts`: `cn()` utility function combining `clsx` and `tailwind-merge`.
5. Create `src/components/ui/button.tsx`: Ripple button with Material bouncy motion (`cubic-bezier(0.34, 1.56, 0.64, 1)`), focus ring `ring-pink-focus`, hover border/glow. ENSURE STATIC BUTTON BG IS NOT PINK!
6. Create `src/components/ui/skeleton.tsx`: Hot pink shimmer loading skeleton component (`skeleton-shimmer-pink`).
7. Create `src/components/ui/card.tsx`: Editorial dark card container with `hover:border-[#FF2D87]` transition.
8. Create `src/components/ui/badge.tsx`: Category badges (Tech, Books, Workshop) and status badges (Available, Sold Out, Limited).
9. Create `src/components/ui/input.tsx`: Form input component with pink focus ring (`focus-visible:ring-[#FF2D87]`).
10. Create `src/components/ui/modal.tsx`: Framer Motion modal dialog with Apple spring easing (`cubic-bezier(0.25, 0.1, 0.25, 1)`).
11. Create `src/components/ui/qr-ticket.tsx`: Ticket QR Code display using `qrcode.react` or SVG generator.
12. Create `src/components/layout/navbar.tsx`: Editorial black/white navbar with logo, navigation links, and mobile menu drawer.
13. Create `src/components/layout/footer.tsx`: Clean editorial footer.
14. Run `npm run build` in `frontend/` to verify zero build errors.
15. Write handoff report in `.agents/teamwork_preview_worker_m2/handoff.md`.
16. Send message to parent (`a710c097-bdd6-43b3-b651-dbd601fd4d5e`) when complete.

</USER_REQUEST>
