export const WHITE_DOT_BORDER = {
  borderWidth: 0.8,
  borderColor: '#71717A',
} as const

export const THEME_COLORS = {
  bg: {
    primary: '#09090B',
    card: '#121216',
    cardSubtle: '#18181D',
    sheet: '#0E0E12',
    input: '#1C1C22',
  },
  text: {
    primary: '#FFFFFF',
    secondary: '#A1A1AA',
    muted: '#71717A',
    inverted: '#09090B',
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
