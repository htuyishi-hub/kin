export const Colors = {
  night:       '#0D1117',
  ink:         '#1A1A2E',
  inkRaised:   '#242438',
  trust:       '#2563EB',
  trustDim:    '#1A4DB8',
  trustGlow:   '#2563EB22',
  gold:        '#C9A84C',
  goldDim:     '#8B6A28',
  bone:        '#F0EDE6',
  boneDim:     '#A8A49E',
  boneGhost:   '#4A4742',
  danger:      '#E5534B',
  success:     '#3FB950',
  divider:     '#21262D',
  obsidianNavy: '#0A0E17',
  coral:       '#FF6B6B',
  coralDim:    '#E0564C',
  coralGlow:   'rgba(255, 107, 107, 0.35)',
} as const;

export type ColorKey = keyof typeof Colors;

const colors = {
  light: {
    text:              Colors.bone,
    tint:              Colors.trust,
    background:        Colors.night,
    foreground:        Colors.bone,
    card:              Colors.ink,
    cardForeground:    Colors.bone,
    primary:           Colors.trust,
    primaryForeground: Colors.bone,
    secondary:         Colors.inkRaised,
    secondaryForeground: Colors.boneDim,
    muted:             Colors.inkRaised,
    mutedForeground:   Colors.boneDim,
    accent:            Colors.gold,
    accentForeground:  Colors.ink,
    destructive:       Colors.danger,
    destructiveForeground: Colors.bone,
    border:            Colors.divider,
    input:             Colors.inkRaised,
  },
  radius: 20,
};

export default colors;
