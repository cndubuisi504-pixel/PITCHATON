import type { Config } from 'tailwindcss';

/**
 * PITCHATON design tokens.
 *
 * Brand trio (locked by the ICT Hub brand guide):
 *   neon lime  #d3ff01   → action, winners, focus
 *   charcoal   #1a1a1a   → page background
 *   gray       #4d4d4d   → hairlines, secondary surfaces
 *
 * Everything else is a supporting tone chosen so that text and UI chrome stay
 * WCAG-AA legible on charcoal (raw #4d4d4d text on #1a1a1a is NOT legible, so
 * it is used for borders/dividers only — muted copy uses the "mute" scale).
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          DEFAULT: '#d3ff01',
          50: '#f8ffe0',
          100: '#f0ffb8',
          200: '#e6ff85',
          300: '#dcff4d',
          400: '#d3ff01',
          500: '#b8e000',
          600: '#92b300',
          700: '#6c8500',
          800: '#4a5a00',
          900: '#2b3400',
        },
        charcoal: {
          DEFAULT: '#1a1a1a',
          950: '#0f0f10',
          900: '#1a1a1a',
          850: '#1f1f1f',
          800: '#242424',
          750: '#2a2a2a',
          700: '#313131',
          600: '#3d3d3d',
          500: '#4d4d4d',
          DEFAULT_ACCENT: '#4d4d4d',
        },
        mute: {
          100: '#f4f4f5',
          200: '#d6d6d6',
          300: '#b3b3b1',
          400: '#8f8f8c',
          500: '#6e6e6b',
          600: '#545452',
        },
        status: {
          submitted: '#94a3b8',
          review: '#fbbf24',
          accepted: '#38bdf8',
          finalist: '#c084fc',
          winner: '#d3ff01',
          rejected: '#fb7185',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.08em' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        30: '7.5rem',
      },
      maxWidth: {
        content: '76rem',
        prose: '68ch',
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(211,255,1,0.35), 0 12px 40px -12px rgba(211,255,1,0.35)',
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 18px 40px -28px rgba(0,0,0,0.9)',
        lifted: '0 24px 60px -32px rgba(0,0,0,1)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
