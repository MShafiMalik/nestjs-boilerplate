export const QUEUES = {
  NOTIFICATIONS: 'notifications',
  CRON: 'cron',
} as const;

export const NOTIFICATION_JOBS = {
  WELCOME_EMAIL: 'welcome-email',
  EMAIL_VERIFICATION: 'email-verification',
  PASSWORD_RESET_EMAIL: 'password-reset-email',
} as const;

export const CRON_JOBS = {
  CLEANUP_EXPIRED_SESSIONS: 'cleanup-expired-sessions',
} as const;
