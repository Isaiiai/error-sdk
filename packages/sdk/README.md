# @isaiiai/error-trackers-js-sdk

Browser TypeScript SDK for **Isaii Error Tracker**. Captures exceptions, breadcrumbs, network activity, optional screenshots, page views, support tickets, and maintenance status — then sends them to your Error Tracker API.

## Install

```bash
npm install @isaiiai/error-trackers-js-sdk
```

For React apps, also install [`@isaiiai/error-trackers-react`](https://www.npmjs.com/package/@isaiiai/error-trackers-react).

## Quick start

Create a project in the Error Tracker admin to get `projectKey`, `secretKey`, and your API DSN.

```ts
import ErrorTracker from '@isaiiai/error-trackers-js-sdk';

const tracker = new ErrorTracker({
  projectKey: 'YOUR_PROJECT_KEY',
  secretKey: 'YOUR_SECRET_KEY',
  dsn: 'https://YOUR_API_HOST/api/v1/errors',
  environment: 'production', // or 'staging' | 'development'
  debug: false,
});

// Manual capture
try {
  riskyWork();
} catch (err) {
  tracker.captureException(err, { level: 'high' });
}

// Or a message
tracker.captureMessage('Checkout completed with warnings', 'info');
```

Unhandled `error` and `unhandledrejection` events are captured automatically.

## Configuration

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `projectKey` | yes | — | Project public key |
| `secretKey` | yes | — | Project secret key |
| `dsn` | yes | — | Errors endpoint, e.g. `https://api.example.com/api/v1/errors` |
| `environment` | no | `production` | Environment tag |
| `sampleRate` | no | `1` | 0–1 sampling rate |
| `captureScreenshot` | no | `true` | Viewport screenshot on error |
| `captureNetworkActivity` | no | `true` | Record fetch/XHR trail |
| `trackPageViews` | no | `true` | SPA page-view analytics |
| `checkMaintenance` | no | `true` | Poll maintenance status |
| `debug` | no | `false` | Console debug logs |

## Common APIs

```ts
tracker.setUser({ id: 'u_123', email: 'user@example.com' });
tracker.setTag('plan', 'pro');
tracker.addBreadcrumb({ category: 'ui', message: 'Opened checkout', level: 'info' });

tracker.captureException(error, {
  level: 'critical',
  tags: { area: 'payments' },
  context: { orderId: 'ord_1' },
});

// Support ticket (same project keys)
await tracker.submitSupportRequest({
  title: 'Cannot export report',
  description: 'Export button spins forever',
  category: 'bug',
  priority: 'high',
  reporterEmail: 'user@example.com',
});

// Maintenance
const status = await tracker.refreshMaintenance();
tracker.onMaintenanceChange((s) => {
  if (s.active) console.log('Maintenance live', s.windows);
});
```

## React

Use [`@isaiiai/error-trackers-react`](https://www.npmjs.com/package/@isaiiai/error-trackers-react) for `ErrorTrackerProvider`, `ErrorBoundary`, Support UI, and Maintenance gate.

## License

MIT
