# Original User Request

## 2026-08-06T13:34:49Z

Build the frontend for Kaluna, a serverless event registration and ticketing platform, tailored as a portfolio piece showcasing learning and community events.

Working directory: d:/New folder (6)/kaluna/kaluna/frontend
Integrity mode: development

## Requirements

### R1. Architecture & Framework
Build a Next.js (App Router) application configured for static export (`output: 'export'`). Use Tailwind CSS for styling and Framer Motion for animations. Ensure the app builds to a purely static directory compatible with AWS CloudFront.

### R2. Design System & Motion
Implement a white/black editorial design with a strict `#FF2D87` (hot pink) accent reserved solely for motion/interaction (ripples, hovers, focus states, animated fills). If an element is static, it must not be pink. Use Apple-style spring easing (`cubic-bezier(0.25, 0.1, 0.25, 1)`) for page transitions/reveals, and Material-style bouncy elevation (`cubic-bezier(0.34, 1.56, 0.64, 1)`) and ripples for direct interactions.

### R3. Pages & Components
Build the core views: 
1. Landing / Event Listing (filterable by category)
2. Event Detail
3. Registration Form (with inline validation)
4. Registration Success (with QR ticket)
5. Ticket Lookup
6. Admin Login (Cognito-backed UI)
7. Admin Dashboard (live check-in feed, stat cards, capacity bars)
8. Create/Edit Event
9. 404

### R4. API Integration & Content
Integrate with the existing Kaluna API using the `NEXT_PUBLIC_API_URL` environment variable. Implement loading skeletons (pink shimmer), empty states, success states, and error states (parsing `errorCode` from the API) for every endpoint. Seed the UI with high-quality, realistic demo content for "learning and community events" (Tech, Books, Workshop).

## Acceptance Criteria

### Configuration & Build
- [ ] Running `npm run build` successfully generates an `out/` directory with a static export of the application.

### Design Integrity
- [ ] Code search confirms `#FF2D87` (or corresponding Tailwind class) is only applied to interactive states (hover, focus, active, animations) and never to static text colors or background fills.

### Functionality
- [ ] All specified routes exist and are accessible via Next.js navigation.
- [ ] All data fetching and mutations use the `NEXT_PUBLIC_API_URL` environment variable, never a hardcoded localhost URL.
- [ ] API error handling reads the `errorCode` field from the JSON response to display specific error messages.
