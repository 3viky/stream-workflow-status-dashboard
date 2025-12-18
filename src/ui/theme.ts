/**
 * Self-contained theme for stream-workflow-status dashboard
 * No external dependencies - production ready
 */

export const theme = {
  colors: {
    // Background
    background: {
      primary: '#0a0a0a',
      secondary: '#1a1a1a',
      tertiary: '#2a2a2a',
    },
    bg: {
      primary: '#0a0a0a',
      secondary: '#1a1a1a',
      tertiary: '#2a2a2a',
    },
    surface: '#1a1a1a',
    // Text
    text: {
      primary: '#ffffff',
      secondary: '#a0a0a0',
      muted: '#666666',
    },
    // Accents
    primary: '#ff0080',      // magenta
    secondary: '#00ffff',    // cyan
    success: '#00ff00',      // green
    warning: '#ff8800',      // orange
    error: '#ff0000',        // red
    info: '#00ffff',         // cyan
    // Borders
    border: '#333333',
    // Hover states
    hover: {
      surface: '#222222',
      primary: '#ff66ff',
      secondary: '#66ffff',
    },
  },
  transitions: {
    normal: '0.2s ease',
    fast: '0.1s ease',
    slow: '0.3s ease',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '24px',
    xxl: '32px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    bold: 700,
  },
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    glow: '0 0 10px rgba(255, 0, 128, 0.5)',
  },
} as const

export type Theme = typeof theme
