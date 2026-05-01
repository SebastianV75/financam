import type { Config } from 'tailwindcss';

const config: Config = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  presets: [require('nativewind/preset')],
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#F7F8FA',
        surface: '#FFFFFF',
        text: '#0F172A',
        muted: '#64748B',
        primary: '#0F766E',
        border: '#E2E8F0',
        danger: '#B91C1C',
      },
    },
  },
  plugins: [],
};

export default config;
