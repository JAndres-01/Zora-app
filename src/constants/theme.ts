export const WHITE_DOT_BORDER = {
  borderWidth: 0.8,
  borderColor: '#71717A',
} as const

export const THEME_COLORS = {
  bg: {
    primary: '#000000',
    card: '#000000',
    cardSubtle: '#000000',
    sheet: '#1C1C1E',
    input: '#2C2C2E',
    floating: '#1C1C1E',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    muted: '#71717A',
    inverted: '#000000',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.14)',
    strong: '#27272A',
  },
  semantic: {
    accent: '#FFFFFF',
    danger: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
  },
} as const

export function isWhiteColor(hexColor?: string | null): boolean {
  if (!hexColor) return false
  const norm = hexColor.trim().toUpperCase()
  return norm === '#FFFFFF' || norm === '#FFF' || norm === '#FAFAFA'
}
