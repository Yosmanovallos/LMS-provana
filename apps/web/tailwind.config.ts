import type { Config } from 'tailwindcss';

/**
 * "Career ledger" theme (ADR-010: Tailwind + hand-rolled primitives).
 * Warm paper canvas, ink-green chrome, evergreen primary, amber readiness accent.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#f6f4ee',
          raised: '#fffefb',
          sunken: '#eeebe2',
        },
        ink: {
          DEFAULT: '#1d2723',
          soft: '#48544e',
          faint: '#8a948d',
          line: '#e1ddd1',
        },
        pine: {
          DEFAULT: '#175949',
          deep: '#0e3f33',
          wash: '#e3eee9',
        },
        ember: {
          DEFAULT: '#b45309',
          wash: '#fbeede',
        },
        chrome: {
          DEFAULT: '#15211b',
          line: '#2a3a31',
          text: '#c9d4cb',
          dim: '#7e8d83',
        },
        verdict: {
          ok: '#1e7a4f',
          warn: '#b45309',
          bad: '#a33326',
        },
      },
      fontFamily: {
        display: ['"Palatino Linotype"', 'Palatino', '"Book Antiqua"', 'Georgia', 'serif'],
        body: ['"Segoe UI"', 'Candara', 'Calibri', 'Arial', 'sans-serif'],
        ledger: ['"Cascadia Mono"', 'Consolas', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        ledger: '2px',
      },
      boxShadow: {
        lift: '0 1px 0 rgba(29,39,35,0.04), 0 8px 24px -16px rgba(29,39,35,0.25)',
      },
    },
  },
  plugins: [],
};

export default config;
