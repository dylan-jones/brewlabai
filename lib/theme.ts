import "styled-components";

export const lightTheme = {
  mode: "light",
  colors: {
    background: "#f5f6f7",
    surface: "#ffffff",
    elevated: "#f8f9fa",
    ink: "#232a30",
    muted: "#74808b",
    border: "#e3e7e9",
    accent: "#b65c3b",
    accentSoft: "#fbf1ec",
    green: "#35745a",
    greenSoft: "#edf5ef",
    blue: "#516d92",
    blueSoft: "#eff3f8",
    danger: "#b64f4d",
    warning: "#9b732e",
  },
  fonts: {
    sans: "var(--font-sans), sans-serif",
    mono: "var(--font-mono), monospace",
  },
  typography: {
    xs: "10px",
    sm: "12px",
    body: "13px",
    heading: "18px",
    title: "28px",
  },
  spacing: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48],
  srm: ["#f8f0bd", "#edca62", "#d9a128", "#b46b20", "#793d21", "#382720"],
};

export type BrewTheme = typeof lightTheme;
export const darkTheme: BrewTheme = {
  ...lightTheme,
  mode: "dark",
  colors: {
    background: "#181c1d",
    surface: "#222829",
    elevated: "#2a3031",
    ink: "#e8ece9",
    muted: "#9ba6a4",
    border: "#384142",
    accent: "#e59874",
    accentSoft: "#3a2c25",
    green: "#8cc8a5",
    greenSoft: "#263b30",
    blue: "#9db9dd",
    blueSoft: "#29333f",
    danger: "#f49b97",
    warning: "#d7b46f",
  },
};

declare module "styled-components" {
  export interface DefaultTheme extends BrewTheme {
    mode: string;
  }
}
