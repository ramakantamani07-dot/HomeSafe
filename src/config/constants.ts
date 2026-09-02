export const COLORS = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#DBEAFE',
  danger: '#DC2626',
  dangerDark: '#B91C1C',
  dangerLight: '#FEE2E2',
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
} as const;

export const TIMING = {
  otpExpirySeconds: 600,
  otpResendCooldownSeconds: 60,
} as const;

export const SECURE_STORE_KEYS = {
  session: 'homesafe.auth-session',
  privacyPreferences: 'homesafe.privacy-preferences',
} as const;
