/**
 * Error Tracking Utility
 * Production-safe error tracking with Sentry integration
 * Falls back gracefully if Sentry is not configured
 */

interface ErrorContext {
  userId?: string;
  userAgent?: string;
  url?: string;
  timestamp?: string;
  componentStack?: string;
  additionalArgs?: unknown[];
  [key: string]: unknown;
}

class ErrorTracker {
  private isEnabled: boolean = false;
  private sentryDsn: string | null = null;

  constructor() {
    // Only enable in production
    const isProduction = import.meta.env.PROD;
    this.sentryDsn = import.meta.env.VITE_SENTRY_DSN || null;
    this.isEnabled = isProduction && !!this.sentryDsn;

    if (this.isEnabled) {
      this.initSentry();
    }
  }

  private initSentry(): void {
    // Dynamic import to avoid bundling Sentry in development
    import('@sentry/react').then((Sentry) => {
      Sentry.init({
        dsn: this.sentryDsn!,
        environment: import.meta.env.MODE || 'production',
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
        tracesSampleRate: 0.1, // 10% of transactions
        replaysSessionSampleRate: 0.01, // 1% of sessions
        replaysOnErrorSampleRate: 1.0, // 100% of error sessions
        beforeSend(event) {
          // Don't send errors in development
          if (import.meta.env.DEV) {
            return null;
          }
          return event;
        },
      });
    }).catch(() => {
      // Sentry not available, disable tracking
      this.isEnabled = false;
    });
  }

  captureError(error: Error, context?: ErrorContext): void {
    if (!this.isEnabled) {
      // Fallback to console in development
      console.error('Error captured:', error, context);
      return;
    }

    import('@sentry/react').then((Sentry) => {
      Sentry.withScope((scope) => {
        if (context) {
          Object.keys(context).forEach((key) => {
            scope.setContext(key, { value: context[key] });
          });
        }
        Sentry.captureException(error);
      });
    }).catch(() => {
      // Sentry not available
      console.error('Error captured (Sentry unavailable):', error, context);
    });
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    const consoleMethod = level === 'warning' ? 'warn' : level;
    if (!this.isEnabled) {
      console[consoleMethod]('Message captured:', message, context);
      return;
    }

    import('@sentry/react').then((Sentry) => {
      Sentry.withScope((scope) => {
        if (context) {
          Object.keys(context).forEach((key) => {
            scope.setContext(key, { value: context[key] });
          });
        }
        Sentry.captureMessage(message, level);
      });
    }).catch(() => {
      console[consoleMethod]('Message captured (Sentry unavailable):', message, context);
    });
  }

  setUser(userId: string, email?: string, username?: string): void {
    if (!this.isEnabled) return;

    import('@sentry/react').then((Sentry) => {
      Sentry.setUser({
        id: userId,
        email,
        username,
      });
    }).catch(() => {
      // Sentry not available
    });
  }

  addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' = 'info', data?: Record<string, unknown>): void {
    if (!this.isEnabled) return;

    import('@sentry/react').then((Sentry) => {
      Sentry.addBreadcrumb({
        message,
        category,
        level,
        data,
        timestamp: Date.now() / 1000,
      });
    }).catch(() => {
      // Sentry not available
    });
  }
}

export const errorTracker = new ErrorTracker();
