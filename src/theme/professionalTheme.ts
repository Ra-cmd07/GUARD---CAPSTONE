// Professional School Design System
// Based on enterprise-grade education platform standards

export const colors = {
  // Primary Brand Colors
  primary: {
    main: '#3b82f6',      // Bright Professional Blue (for tabs/buttons)
    light: '#3b82f6',     // Bright Accent Blue
    dark: '#2563eb',      // Slightly darker blue (for backgrounds)
    gradient: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', // Darker to lighter
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#3b82f6',
    700: '#3b82f6',
    800: '#2563eb',      // Darker for backgrounds
    900: '#2563eb',      // Darker for backgrounds
  },
  
  // Secondary/Accent Colors
  secondary: {
    main: '#059669',      // Trust Green (for success)
    light: '#10b981',
    dark: '#047857',
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
  },
  
  // Neutral Tones
  neutral: {
    50: '#f9fafb',        // Very light gray backgrounds
    100: '#f3f4f6',       // Card backgrounds
    200: '#e5e7eb',       // Borders
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',       // Text secondary
    600: '#4b5563',
    700: '#374151',       // Text primary
    800: '#1f2937',
    900: '#111827',       // Headers
  },
  
  // Status Colors
  status: {
    success: {
      main: '#10b981',
      light: '#d1fae5',
      dark: '#065f46',
      border: '#a7f3d0'
    },
    warning: {
      main: '#f59e0b',
      light: '#fef3c7',
      dark: '#92400e',
      border: '#fde68a'
    },
    error: {
      main: '#ef4444',
      light: '#fee2e2',
      dark: '#991b1b',
      border: '#fecaca'
    },
    info: {
      main: '#3b82f6',
      light: '#dbeafe',
      dark: '#3b82f6',
      border: '#bfdbfe'
    }
  }
};

export const typography = {
  fontFamily: {
    primary: '"Inter", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
    display: '"Poppins", "Inter", sans-serif',
    mono: '"JetBrains Mono", "Courier New", monospace'
  },
  
  fontSize: {
    // Display
    displayXl: '4.5rem',    // 72px
    displayLg: '3.5rem',    // 56px
    
    // Headings
    h1: '2.25rem',          // 36px
    h2: '1.875rem',         // 30px
    h3: '1.5rem',           // 24px
    h4: '1.25rem',          // 20px
    h5: '1.125rem',         // 18px
    h6: '1rem',             // 16px
    
    // Body
    lg: '1.125rem',         // 18px
    base: '1rem',           // 16px
    sm: '0.875rem',         // 14px
    xs: '0.75rem',          // 12px
    
    // UI
    button: '0.9375rem',    // 15px
    caption: '0.75rem',     // 12px
  },
  
  fontWeight: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  }
};

export const spacing = {
  // Base unit: 8px
  0: '0',
  px: '1px',
  0.5: '4px',      // 0.5 * 8
  1: '8px',        // 1 * 8
  2: '16px',       // 2 * 8
  3: '24px',       // 3 * 8
  4: '32px',       // 4 * 8
  5: '40px',       // 5 * 8
  6: '48px',       // 6 * 8
  8: '64px',       // 8 * 8
  10: '80px',      // 10 * 8
  12: '96px',      // 12 * 8
  16: '128px',     // 16 * 8
  20: '160px',     // 20 * 8
  24: '192px',     // 24 * 8
  
  // Common use cases
  cardPadding: '24px',
  sectionPadding: '64px',
  inputHeight: '48px',
  buttonHeight: '44px',
};

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  
  // Elevation system
  elevation1: '0 1px 3px rgba(0,0,0,0.1)',
  elevation2: '0 4px 6px rgba(0,0,0,0.1)',
  elevation3: '0 10px 15px rgba(0,0,0,0.1)',
  elevation4: '0 20px 25px rgba(0,0,0,0.15)',
  
  // Hover states
  hoverLift: '0 8px 16px rgba(30,64,175,0.25)',
};

export const borderRadius = {
  none: '0',
  sm: '4px',
  base: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
  
  // Component specific
  button: '8px',
  card: '16px',
  input: '8px',
  badge: '6px',
};

export const transitions = {
  fast: '150ms ease',
  base: '200ms ease',
  slow: '300ms ease',
  slower: '500ms ease',
  
  // Specific transitions
  button: 'all 200ms ease',
  card: 'all 300ms ease',
  dropdown: 'all 150ms ease',
};

// Component-specific styles
export const components = {
  button: {
    primary: {
      background: colors.primary.gradient,
      color: '#ffffff',
      padding: '12px 24px',
      borderRadius: borderRadius.button,
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.button,
      letterSpacing: '0.02em',
      boxShadow: shadows.md,
      transition: transitions.button,
      hover: {
        transform: 'translateY(-2px)',
        boxShadow: shadows.hoverLift,
      }
    },
    secondary: {
      background: colors.neutral[100],
      color: colors.neutral[700],
      border: `2px solid ${colors.neutral[200]}`,
      padding: '12px 24px',
      borderRadius: borderRadius.button,
      fontWeight: typography.fontWeight.semibold,
      fontSize: typography.fontSize.button,
      transition: transitions.button,
      hover: {
        background: colors.neutral[200],
        border: `2px solid ${colors.neutral[300]}`,
      }
    }
  },
  
  card: {
    default: {
      background: '#ffffff',
      borderRadius: borderRadius.card,
      padding: spacing.cardPadding,
      boxShadow: shadows.elevation2,
      border: `1px solid ${colors.neutral[200]}`,
      transition: transitions.card,
      hover: {
        transform: 'translateY(-4px)',
        boxShadow: shadows.elevation3,
      }
    }
  },
  
  badge: {
    success: {
      background: colors.status.success.light,
      color: colors.status.success.dark,
      border: `1px solid ${colors.status.success.border}`,
      padding: '6px 12px',
      borderRadius: borderRadius.badge,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    warning: {
      background: colors.status.warning.light,
      color: colors.status.warning.dark,
      border: `1px solid ${colors.status.warning.border}`,
      padding: '6px 12px',
      borderRadius: borderRadius.badge,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    error: {
      background: colors.status.error.light,
      color: colors.status.error.dark,
      border: `1px solid ${colors.status.error.border}`,
      padding: '6px 12px',
      borderRadius: borderRadius.badge,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    },
    info: {
      background: colors.status.info.light,
      color: colors.status.info.dark,
      border: `1px solid ${colors.status.info.border}`,
      padding: '6px 12px',
      borderRadius: borderRadius.badge,
      fontSize: typography.fontSize.xs,
      fontWeight: typography.fontWeight.semibold,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
    }
  }
};

export default {
  colors,
  typography,
  spacing,
  shadows,
  borderRadius,
  transitions,
  components,
};
