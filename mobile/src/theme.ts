// Central design tokens. Dark-first, like the best finance apps.
export const theme = {
  colors: {
    bg: "#0B0E14",
    card: "#151A23",
    cardBorder: "#232A36",
    text: "#F5F7FA",
    textDim: "#8A94A6",
    accent: "#4C8DFF",
    up: "#2ECC71",
    down: "#FF5A5F",
    // Advanced-mode gradient hero (blue → indigo, per design reference).
    gradientStart: "#2D6BFF",
    gradientEnd: "#6C4CFF",
    tile: "#1B2130",
  },
  radius: 16,
  spacing: (n: number) => n * 8,
};

export const gainColor = (v: number) =>
  v >= 0 ? theme.colors.up : theme.colors.down;

export const money = (v: number) =>
  `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
