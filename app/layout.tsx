import type { Metadata, Viewport } from 'next';

// Self-hosted variable fonts (npm packages) — no external font CDN, no
// build-time network calls, and the exact same render on every machine.
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './globals.css';

import { AuthProvider } from '@/components/AuthProvider';
import { Footer } from '@/components/Footer';
import { Navigation } from '@/components/Navigation';
import { ToastProvider } from '@/components/ui';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const hubName = process.env.NEXT_PUBLIC_HUB_NAME ?? 'ICT Hub';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'PITCHATON · ICT Hub Semester Pitch Competition',
    template: '%s · PITCHATON',
  },
  description:
    'PITCHATON is the ICT Hub semester pitch competition platform: founders submit their ideas, reviewers move them through to the final, and the whole campus follows the leaderboard.',
  applicationName: 'PITCHATON',
  keywords: ['pitch competition', 'ICT Hub', 'startup', 'innovation', 'Enugu', 'PITCHATON'],
  authors: [{ name: `${hubName} ICT Hub` }],
  openGraph: {
    type: 'website',
    siteName: 'PITCHATON',
    title: 'PITCHATON · ICT Hub Semester Pitch Competition',
    description:
      'Submit your semester pitch, follow the review pipeline, and see who takes the top spot.',
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PITCHATON · ICT Hub Semester Pitch Competition',
    description: 'Submit your semester pitch. Follow the journey. Watch the leaderboard.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0f0f10',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once per request: the session drives nav state and admin entry points.
  const [user, settings] = await Promise.all([getCurrentUser(), getStore().getSettings()]);

  return (
    <html lang="en">
      <body className="min-h-dvh font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-lime focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-charcoal-950"
        >
          Skip to content
        </a>

        <ToastProvider>
          <AuthProvider user={user}>
            <div className="flex min-h-dvh flex-col">
              <Navigation hubName={settings.hub_name} />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer hubName={settings.hub_name} institution={settings.institution_name} />
            </div>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
