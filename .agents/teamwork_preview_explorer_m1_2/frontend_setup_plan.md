# Next.js Static Export Frontend Setup Plan

## 1. System Environment Assessment

- **Node.js Version**: `v24.15.0` (Verified via `node -v`)
- **npm Version**: `11.12.1` (Verified via `npm -v`)
- **OS Platform**: Windows (win32)
- **Target Directory**: `d:\New folder (6)\kaluna\kaluna\frontend`
- **Current Status**: `frontend/` directory exists and is currently empty.

Both Node.js 24.x and npm 11.x are fully compatible with Next.js 14/15, React 18, Tailwind CSS v3/v4, Framer Motion, and TypeScript.

---

## 2. Dependencies & `package.json` Specification

Below is the complete `package.json` definition configured with all requested frontend libraries.

```json
{
  "name": "kaluna-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "framer-motion": "^11.11.17",
    "lucide-react": "^0.460.0",
    "next": "^14.2.18",
    "qrcode.react": "^4.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/node": "^20.17.6",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.1",
    "eslint-config-next": "^14.2.18",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3"
  }
}
```

### Dependency Rationale:
- **`next` (14.2.x)**: Production-ready App Router with native support for `output: 'export'`.
- **`react` / `react-dom` (18.3.x)**: Standard stable React version compatible with standard UI libraries.
- **`framer-motion`**: Smooth UI transitions and micro-interactions for event details, registration modals, and ticket badges.
- **`lucide-react`**: Clean, modern SVG icon set for navigation, event badges, search filters, and status indicators.
- **`qrcode.react`**: Client-side QR code rendering for event tickets and ticket verification scanners.
- **`clsx` + `tailwind-merge`**: Utility function setup (`cn(...)`) for conditional Tailwind CSS classes.
- **`tailwindcss` + `autoprefixer` + `postcss`**: Utility-first CSS framework for modern styling.

---

## 3. Static Export Configuration (`next.config.mjs`)

Next.js require specific settings for static site export (HTML/CSS/JS output into `out/` directory for deployment on S3/CloudFront/Netlify/Vercel/GitHub Pages):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
```

### Key Settings Explained:
- `output: 'export'`: Enables Next.js static HTML export, generating static files in the `out/` folder upon `npm run build`.
- `images: { unoptimized: true }`: Disables Node server image optimization runtime, ensuring `<Image />` components work seamlessly in static export builds.
- `trailingSlash: true`: Generates static paths with trailing slashes (`/events/index.html` vs `/events.html`), improving static hosting web server route resolution.

---

## 4. Supporting Configuration Files

### 4.1 `tsconfig.json`
```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 4.2 `tailwind.config.ts`
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        }
      },
    },
  },
  plugins: [],
};
export default config;
```

### 4.3 `postcss.config.mjs`
```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

### 4.4 `.gitignore`
```
# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js build output
/.next/
/out/

# production
/build

# debug logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# local env files
.env*.local
.env

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

---

## 5. Target Directory Structure

The proposed structure follows Next.js 14 App Router standard practice:

```
frontend/
├── .gitignore
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── favicon.ico
│   └── logo.svg
└── src/
    ├── app/
    │   ├── layout.tsx                # Root layout with navbar & footer
    │   ├── page.tsx                  # Home / Public Event Catalog
    │   ├── globals.css               # Tailwind directives & base styles
    │   ├── events/
    │   │   └── [eventId]/
    │   │       └── page.tsx          # Event Detail & Ticket Registration
    │   ├── tickets/
    │   │   └── [ticketId]/
    │   │       └── page.tsx          # Ticket Pass view (QR Code, Check-in status)
    │   ├── admin/
    │   │   ├── page.tsx              # Admin Dashboard (Event list, quick actions)
    │   │   ├── events/
    │   │   │   ├── new/
    │   │   │   │   └── page.tsx      # Create Event Form
    │   │   │   └── [eventId]/
    │   │   │       └── page.tsx      # Event Attendee List, CSV Export, Check-in Stats
    │   │   └── checkin/
    │   │       └── page.tsx          # Live Ticket Check-in / QR Scanner UI
    │   └── analytics/
    │       └── page.tsx              # Event Analytics Dashboard
    ├── components/
    │   ├── ui/
    │   │   ├── button.tsx            # Button component
    │   │   ├── card.tsx              # Card component
    │   │   ├── input.tsx             # Form input component
    │   │   ├── modal.tsx             # Modal / Dialog component
    │   │   ├── badge.tsx             # Status badge component
    │   │   └── toast.tsx             # Notification toast
    │   ├── layout/
    │   │   ├── navbar.tsx            # Navigation header
    │   │   └── footer.tsx            # Footer
    │   ├── events/
    │   │   ├── event-card.tsx        # Event display card
    │   │   ├── event-filter.tsx      # Status filter (available/limited/sold_out)
    │   │   └── registration-form.tsx # Registration modal form
    │   ├── tickets/
    │   │   └── qr-display.tsx        # QR code renderer using qrcode.react
    │   └── admin/
    │       ├── checkin-scanner.tsx   # Ticket lookup / check-in handler
    │       └── registration-table.tsx# Attendee table with CSV download button
    ├── lib/
    │   ├── api.ts                    # API client fetching backend endpoints (/api/v1)
    │   ├── utils.ts                  # Utility function (cn combining clsx & tailwind-merge)
    │   └── types.ts                  # TypeScript interfaces matching openapi.yaml
    └── hooks/
        ├── use-events.ts             # Custom hook for fetching events
        ├── use-ticket.ts             # Custom hook for ticket details
        └── use-checkin.ts            # Custom hook for check-in action
```

---

## 6. Dynamic Route Handling Strategy for Static Export

When building a Next.js App Router application with `output: 'export'`, dynamic routes like `/events/[eventId]` and `/tickets/[ticketId]` need a static export strategy:

1. **`generateStaticParams()` Setup**:
   In dynamic route `page.tsx` files (e.g. `src/app/events/[eventId]/page.tsx`), export a `generateStaticParams` function that returns dummy or pre-rendered parameters, e.g.:
   ```typescript
   export async function generateStaticParams() {
     // Return static params placeholder or known IDs
     return [{ eventId: 'placeholder' }];
   }
   ```
2. **Client-Side Data Fetching (`'use client'`)**:
   Dynamic route pages receive `params` or use `useParams()` from `next/navigation` to read the runtime ID and fetch data from the API (`NEXT_PUBLIC_API_BASE_URL`) dynamically in the browser using standard `useEffect` or SWR/React Query pattern.

---

## 7. Environment Variables Configuration

Create `.env.example` and `.env.local` inside `frontend/`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.kaluna.bennyduah.com/api/v1
```

For local testing or dev:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

---

## 8. Execution Checklist for Implementation Phase

1. **Initialize Project Files**:
   - Write `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, and `.gitignore` in `frontend/`.
2. **Install Dependencies**:
   - Run `npm install` inside `frontend/`.
3. **Create Source Files**:
   - Create `src/lib/utils.ts` with `cn()` implementation.
   - Create `src/lib/types.ts` based on `openapi.yaml`.
   - Create `src/lib/api.ts` for API interactions.
   - Create UI components and page routes.
4. **Verify Static Export Build**:
   - Run `npm run build` inside `frontend/` to confirm Next.js exports static files into `frontend/out/` without errors.
