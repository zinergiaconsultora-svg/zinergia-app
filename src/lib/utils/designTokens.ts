/**
 * Design Tokens for Zinergia
 * Based on 8-point grid system for consistent spacing
 */

export const tokens = {
  spacing: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '5': '1.25rem',
    '6': '1.5rem',
    '8': '2rem',
    '10': '2.5rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
    '32': '8rem',
    '40': '10rem',
    '48': '12rem',
    '56': '14rem',
    '64': '16rem',
  },
  fontSize: {
    'xs': '0.75rem',
    'sm': '0.875rem',
    'base': '1rem',
    'lg': '1.125rem',
    'xl': '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
  },
  fontWeight: {
    'light': '300',
    'normal': '400',
    'medium': '500',
    'semibold': '600',
    'bold': '700',
    'extrabold': '800',
    'black': '900',
  },
  lineHeight: {
    'tight': '1.25',
    'snug': '1.375',
    'normal': '1.5',
    'relaxed': '1.625',
    'loose': '2',
  },
  borderRadius: {
    'none': '0',
    'sm': '0.125rem',
    'base': '0.25rem',
    'md': '0.375rem',
    'lg': '0.5rem',
    'xl': '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    'full': '9999px',
  },
  boxShadow: {
    'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    'base': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
    'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
    'none': 'none',
  },
  zIndex: {
    'hide': -1,
    'base': 0,
    'dropdown': 10,
    'sticky': 20,
    'fixed': 30,
    'modalBackdrop': 40,
    'modal': 50,
    'popover': 60,
    'tooltip': 70,
  },
  transition: {
    'fast': '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    'base': '200ms cubic-bezier(0.4, 0, 0.2, 1)',
    'slow': '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    'slower': '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export type SpacingToken = keyof typeof tokens.spacing;
export type FontSizeToken = keyof typeof tokens.fontSize;
export type FontWeightToken = keyof typeof tokens.fontWeight;
export type BorderRadiusToken = keyof typeof tokens.borderRadius;

export const spacing = (value: SpacingToken): string => tokens.spacing[value];
export const fontSize = (value: FontSizeToken): string => tokens.fontSize[value];
export const fontWeight = (value: FontWeightToken): string => tokens.fontWeight[value];
export const borderRadius = (value: BorderRadiusToken): string => tokens.borderRadius[value];
