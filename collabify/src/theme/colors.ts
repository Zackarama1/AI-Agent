export const palette = {
  purple: '#5B3DF5',
  ink: '#1D1D1F',
  grey: '#F5F5F7',
  white: '#FBFBFD',
  green: '#34C759',
  greenText: '#248A3D',
};

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  primarySoft: string;
  money: string;
  moneyText: string;
  moneySoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
};

export const light: ThemeColors = {
  background: palette.white,
  surface: '#FFFFFF',
  surfaceAlt: palette.grey,
  text: palette.ink,
  textMuted: '#6E6E73',
  border: '#E5E5EA',
  primary: palette.purple,
  primaryText: '#FFFFFF',
  primarySoft: '#EEEAFE',
  money: palette.green,
  moneyText: palette.greenText,
  moneySoft: '#E8F8EC',
  warning: '#B25000',
  warningSoft: '#FFF3E0',
  danger: '#D70015',
  dangerSoft: '#FDECEE',
};

export const dark: ThemeColors = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  text: '#F5F5F7',
  textMuted: '#98989D',
  border: '#38383A',
  primary: '#7B63FF',
  primaryText: '#FFFFFF',
  primarySoft: '#2A2350',
  money: '#30D158',
  moneyText: '#30D158',
  moneySoft: '#123A1E',
  warning: '#FFB340',
  warningSoft: '#3A2A10',
  danger: '#FF6961',
  dangerSoft: '#3A1517',
};
