import { createContext } from 'react';

export const PopupThemeContext = createContext(false);
export const popupColors = {
  card: '#FFFFFF',
  primary: '#2a2a2a',
  secondary: '#f5f5f5',
  primaryText: '#FFFFFF',
  secondaryText: '#2a2a2a',
} as const;

export function popupButtonColors(secondary: boolean) {
  return {
    backgroundColor: secondary ? popupColors.secondary : popupColors.primary,
    color: secondary ? popupColors.secondaryText : popupColors.primaryText,
  };
}
