/**
 * Server-side configuration.
 *
 * NEVER import this file from a client component — it reads private
 * environment variables (service role key, session secret, admin access code).
 * Anything the browser needs must go through an API route.
 */

function list(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return items.length ? items : fallback;
}

export const config = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'pitch-files',
  },

  /** Accounts hard-promoted to admin at signup/seed time (emails only). */
  adminEmails: list(process.env.ADMIN_EMAILS ?? process.env.PITCHATON_ADMIN_EMAILS, [
    'contacteihpitchaton@gmail.com',
  ]),

  /**
   * Secret every admin must enter once, on the signup form, to mint an admin
   * account. This is the "admin key" — change it in Vercel before going live.
   */
  adminAccessCode: process.env.ADMIN_ACCESS_CODE?.trim() || 'PITCHATON-ADMIN',

  /** Typed code the client sends when the user ticks "I'm an administrator". */
  adminClaimToken: process.env.ADMIN_CLAIM_TOKEN?.trim() || 'ADMIN',

  session: {
    secret: process.env.SESSION_SECRET?.trim() || '',
    cookieName: 'pitchaton_session',
    /** 7 days */
    maxAgeSeconds: 60 * 60 * 24 * 7,
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY?.trim() || '',
    // Resend's onboarding sender works with zero DNS setup.
    from: process.env.EMAIL_FROM?.trim() || 'PITCHATON <onboarding@resend.dev>',
    adminFrom: process.env.EMAIL_ADMIN_FROM?.trim() || '',
    /** When set, notifications are delivered here instead of the real inbox (dev safety). */
    devOverride: process.env.EMAIL_DEV_OVERRIDE?.trim() || '',
  },

  site: {
    url: process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000',
    hubName: process.env.NEXT_PUBLIC_HUB_NAME?.trim() || 'ICT Hub',
    institution:
      process.env.NEXT_PUBLIC_INSTITUTION_NAME?.trim() || 'ICT Hub · Enugu, Nigeria',
  },

  uploads: {
    maxFileBytes: 50 * 1024 * 1024, // 50 MB per file, per spec
    maxFilesPerPitch: 10,
    maxTotalBytesPerPitch: 120 * 1024 * 1024,
  },
} as const;

export const supabaseConfigured = Boolean(
  config.supabase.url && config.supabase.serviceRoleKey,
);

export const emailsConfigured = Boolean(config.email.resendApiKey);

export const isProduction = process.env.NODE_ENV === 'production';
