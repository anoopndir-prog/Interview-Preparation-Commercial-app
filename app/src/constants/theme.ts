import '@/global.css';

import { Platform } from 'react-native';

import type { Difficulty, SectionKind } from '@/lib/types';

/** SKF blue anchors the brand; everything else is tuned to sit calmly around it. */
export const Brand = {
  blue: '#0F58D6',
  blueDark: '#0A3F9E',
  blueDeep: '#062B6F',
  blueSoft: '#E8F0FD',
  blueMist: '#F4F8FE',
  sun: '#F5A524', // streaks & celebrations — the one warm accent
  sunSoft: '#FFF4E0',
} as const;

export const Colors = {
  background: '#F4F7FC',
  card: '#FFFFFF',
  text: '#0B1B33',
  textSecondary: '#55657F',
  textMuted: '#8795AB',
  border: '#E1E7F0',
  success: '#1E8E4E',
  warning: '#B7791F',
  danger: '#C4362F',
  onBrand: '#FFFFFF',
  onBrandMuted: 'rgba(255,255,255,0.78)',
} as const;

/** Each section type gets its own professional hue, distinct from the SKF brand blue. */
export const SectionColors: Record<SectionKind, string> = {
  technical: '#3949AB',
  coding: '#0277BD',
  system_design: '#6A1B9A',
  behavioral: '#00897B',
  hr: '#B7791F',
  situational: '#AD1457',
  domain: '#2E7D32',
  leadership: '#37474F',
  case_study: '#D84315',
  communication: '#00838F',
};

export const sectionColor = (kind: string) => SectionColors[kind as SectionKind] ?? Brand.blue;

/** 8% tint of a hex colour, for soft card backgrounds. */
export const tint = (hex: string, alpha = 0.08) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;

export const DifficultyColors: Record<Difficulty, string> = {
  easy: '#1E8E4E',
  medium: '#B7791F',
  hard: '#C4362F',
};

export const scoreColor = (score: number | null) =>
  score === null ? Colors.textMuted : score >= 7 ? Colors.success : score >= 5 ? Colors.warning : Colors.danger;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  web: { sans: 'var(--font-display)', rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 760;

export const Shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(11,27,51,0.06), 0 4px 14px rgba(11,27,51,0.05)' },
  default: {
    shadowColor: '#0B1B33',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
});
