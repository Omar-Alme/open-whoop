/**
 * OpenWhoop design tokens — dark, modern, lime-green accent.
 * Mirrors the Opus 4.7 dashboard mock.
 */

export const colors = {
  bg: "#0A0B0F",
  bgGradient: ["#0A0B0F", "#13141A"] as const,

  card: "#15171F",
  cardRaised: "#1B1E27",
  cardBorder: "#23262F",

  divider: "#23262F",
  pill: "#22252E",

  textPrimary: "#FFFFFF",
  textSecondary: "#8A8F98",
  textMuted: "#5A5F6A",

  // Accents
  lime: "#C8FF3D",
  limeDark: "#9FCC2A",
  limeOnDark: "#C8FF3D",
  limeText: "#1A1F0A",

  coral: "#FF5A5F",
  coralSoft: "#FF7A7F",

  cyan: "#5AC8FA",
  cyanSoft: "#7DD3FA",

  amber: "#FFB547",
  amberSoft: "#FFC56E",

  purple: "#A78BFA",
  purpleSoft: "#C4B5FD",

  green: "#4CD964",

  ringTrack: "#1F2330",
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const typography = {
  hero: {
    fontSize: 56,
    fontWeight: "700" as const,
    letterSpacing: -1.5,
  },
  display: {
    fontSize: 40,
    fontWeight: "700" as const,
    letterSpacing: -1,
  },
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "600" as const,
  },
  metric: {
    fontSize: 32,
    fontWeight: "700" as const,
    letterSpacing: -0.5,
  },
  metricSm: {
    fontSize: 22,
    fontWeight: "700" as const,
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  label: {
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },
};
