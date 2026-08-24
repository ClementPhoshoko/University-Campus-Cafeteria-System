import { createContext, useContext, useState, useMemo } from 'react';

const ThemeContext = createContext(null);

const lightTheme = {
  name: 'light',
  colors: {
    bg: {
      app: 'var(--color-bg-app)',
      default: 'var(--color-bg-default)',
      secondary: 'var(--color-bg-secondary)',
      tertiary: 'var(--color-bg-tertiary)',
    },
    surface: {
      default: 'var(--color-surface-default)',
      raised: 'var(--color-surface-raised)',
      subtle: 'var(--color-surface-subtle)',
      selected: 'var(--color-surface-selected)',
      disabled: 'var(--color-surface-disabled)',
    },
    text: {
      primary: 'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      tertiary: 'var(--color-text-tertiary)',
      placeholder: 'var(--color-text-placeholder)',
      disabled: 'var(--color-text-disabled)',
      inverse: 'var(--color-text-inverse)',
    },
    border: {
      default: 'var(--color-border-default)',
      subtle: 'var(--color-border-subtle)',
      strong: 'var(--color-border-strong)',
      focus: 'var(--color-border-focus)',
      selected: 'var(--color-border-selected)',
    },
    action: {
      primary: 'var(--color-action-primary)',
      primaryHover: 'var(--color-action-primary-hover)',
      primaryPressed: 'var(--color-action-primary-pressed)',
      primaryText: 'var(--color-action-primary-text)',
      secondary: 'var(--color-action-secondary)',
      secondaryText: 'var(--color-action-secondary-text)',
      link: 'var(--color-action-link)',
      disabled: 'var(--color-action-disabled)',
      disabledText: 'var(--color-action-disabled-text)',
    },
    icon: {
      primary: 'var(--color-icon-primary)',
      secondary: 'var(--color-icon-secondary)',
      tertiary: 'var(--color-icon-tertiary)',
      active: 'var(--color-icon-active)',
      disabled: 'var(--color-icon-disabled)',
      inverse: 'var(--color-icon-inverse)',
    },
    status: {
      success: 'var(--color-status-success)',
      warning: 'var(--color-status-warning)',
      error: 'var(--color-status-error)',
      info: 'var(--color-status-info)',
    },
  },
  glass: {
    bg: 'var(--glass-bg)',
    bgHeavy: 'var(--glass-bg-heavy)',
    bgLight: 'var(--glass-bg-light)',
    border: 'var(--glass-border)',
    blur: 'var(--glass-blur)',
    blurHeavy: 'var(--glass-blur-heavy)',
    shadow: 'var(--glass-shadow)',
  },
  radius: {
    none: 'var(--radius-none)',
    xs: 'var(--radius-xs)',
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)',
    xxl: 'var(--radius-2xl)',
    full: 'var(--radius-full)',
  },
  elevation: {
    none: 'var(--elevation-none)',
    sm: 'var(--elevation-sm)',
    md: 'var(--elevation-md)',
    lg: 'var(--elevation-lg)',
  },
  space: {
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    5: 'var(--space-5)',
    6: 'var(--space-6)',
    7: 'var(--space-7)',
    8: 'var(--space-8)',
    10: 'var(--space-10)',
    12: 'var(--space-12)',
    14: 'var(--space-14)',
    16: 'var(--space-16)',
    20: 'var(--space-20)',
    24: 'var(--space-24)',
  },
};

export function ThemeProvider({ children }) {
  const [theme] = useState(lightTheme);

  const value = useMemo(() => ({
    theme,
    isDark: false,
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export default ThemeContext;