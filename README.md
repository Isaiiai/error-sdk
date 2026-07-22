# Error Tracker SDK System

End-to-end error tracking and project monitoring platform (TypeScript), based on the PRD MVP.

## Architecture

| Package | Description |
|---------|-------------|
| `apps/api` | Express + MongoDB API (`/api/v1`) |
| `apps/admin` | React admin dashboard (MUI + Redux + React Query) |
| `packages/sdk` | Browser TypeScript SDK (`@error-tracker/js-sdk`) |
| `packages/react` | React ErrorBoundary + hooks (`@error-tracker/react`) |

## Quick start

### 1. Start MongoDB (and Redis)

```bash
docker compose up -d mongo redis
```

Or use a local MongoDB at `mongodb://localhost:27017/error-tracker`.

### 2. Install & configure

```bash
cp .env.example .env
npm install
```

### 3. Seed demo data

```bash
npm run seed
```

Seeded users:

| Email | Password | Role |
|-------|----------|------|
| `admin@errortracker.com` | `AdminPass123!` | Admin |
| `pm@errortracker.com` | `PmPass1234!` | Product Manager |
| `dev@errortracker.com` | `DevPass1234!` | Developer |

The seed script prints one-time **project key** and **secret key** for the SDK.

### 4. Run

```bash
# Terminal 1 — API (port 5050; avoids macOS AirPlay on 5000)
npm run dev:api

# Terminal 2 — Admin (port 3000)
npm run dev:admin
```

Open http://localhost:3000 and sign in with `admin@errortracker.com` / `AdminPass123!`.

## SDK usage

```bash
npm run build:sdk
```

```ts
import ErrorTracker from '@error-tracker/js-sdk';

const tracker = new ErrorTracker({
  projectKey: 'pub_...',
  secretKey: 'sec_...',
  dsn: 'http://localhost:5050/api/v1/errors',
  environment: 'production',
  version: '1.0.0',
  debug: true,
  captureScreenshot: true, // default: captures viewport JPEG on each error
});

tracker.setUser({ id: 'user_123', email: 'user@example.com' });
tracker.addBreadcrumb({ category: 'nav', message: 'Opened checkout' });
tracker.captureException(new Error('Something broke'), { level: 'high' });
await tracker.flush();
```

## Screenshot storage (DigitalOcean Spaces)

Set `DO_SPACES_*` in `.env`. On error ingest, screenshots are uploaded to Spaces and the public URL is stored on the error. If Spaces is unavailable, the API falls back to inline storage.

## Customer care widget (React)

```tsx
import { ErrorTrackerProvider, SupportWidget, ErrorBoundary } from '@error-tracker/react';

<ErrorTrackerProvider tracker={tracker}>
  <ErrorBoundary tracker={tracker}>
    <App />
  </ErrorBoundary>
  <SupportWidget />
</ErrorTrackerProvider>
```

Support tickets hit `POST /api/v1/support/tickets` and notify project owners/managers.

## Platform analysis

```ts
const platform = tracker.analyzeFrontend();
// runtime: browser | ios-webview | android-webview | react-native-webview | ...
```

Every captured error includes this analysis automatically.


React:

```tsx
import { ErrorBoundary, ErrorTrackerProvider } from '@error-tracker/react';

<ErrorTrackerProvider tracker={tracker}>
  <ErrorBoundary tracker={tracker}>
    <App />
  </ErrorBoundary>
</ErrorTrackerProvider>
```

See `examples/browser-demo.html` for a zero-build demo page.

## API overview

- `POST /api/v1/auth/register|login|refresh-token|logout`
- `POST /api/v1/errors` — SDK ingest (`X-Project-Key` + `X-Secret-Key`)
- `GET|PATCH /api/v1/errors` — authenticated error management
- `CRUD /api/v1/projects` — projects, API keys, members
- `CRUD /api/v1/projects/:id/tickets` — service tickets
- `GET /api/v1/projects/:id/analytics` — metrics & dashboard
- `POST|GET /api/v1/projects/:id/maintenance` — maintenance windows

## Docker (full stack)

```bash
docker compose up --build
```

## Project structure

```
apps/
  api/          Backend (Express + Mongoose)
  admin/        Admin SPA (Vite + React)
packages/
  sdk/          @error-tracker/js-sdk
  react/        @error-tracker/react
examples/       Browser demo
```
