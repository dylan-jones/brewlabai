"use client";

import { useEffect } from "react";
import { ThemeProvider, createGlobalStyle, keyframes } from "styled-components";
import { lightTheme, darkTheme } from "@/lib/theme";
import { useBrewStore } from "@/lib/store";

const spin = keyframes`to { transform: rotate(360deg); }`;

const GlobalStyle = createGlobalStyle`
  *, *::before, *::after { box-sizing: border-box; }
  html { color-scheme: ${({ theme }) => theme.mode}; scroll-behavior: smooth; }
  body { margin: 0; background: ${({ theme }) => theme.colors.background}; color: ${({ theme }) => theme.colors.ink}; font-family: ${({ theme }) => theme.fonts.sans}; font-size: 13px; line-height: 1.6; letter-spacing: 0; }
  button, input, select, textarea { font: inherit; color: inherit; letter-spacing: 0; }
  button, a, input, select, textarea { -webkit-tap-highlight-color: transparent; }
  button, select { cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: .5; }
  button { touch-action: manipulation; }
  a { color: inherit; text-decoration: none; }
  h1, h2, h3, p { margin: 0; }
  svg { flex-shrink: 0; vertical-align: middle; }
  .lucide-loader-circle, .lucide-loader, .lucide-loader-2 { animation: ${spin} .8s linear infinite; transform-origin: center; transform-box: fill-box; }
  input, select, textarea { min-width: 0; background: ${({ theme }) => theme.colors.surface}; border: 1px solid ${({ theme }) => theme.colors.border}; border-radius: 4px; padding: 8px 10px; }
  :focus-visible { outline: 2px solid ${({ theme }) => theme.colors.accent}; outline-offset: 3px; }
  ::selection { background: ${({ theme }) => theme.colors.accentSoft}; }
  * { scrollbar-width: thin; scrollbar-color: ${({ theme }) => theme.colors.border} transparent; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
    .lucide-loader-circle, .lucide-loader, .lucide-loader-2 { animation: none; }
  }
`;

export default function Providers({ children }: { children: React.ReactNode }) {
  const dark = useBrewStore((state) => state.dark);
  useEffect(() => {
    void useBrewStore.persist.rehydrate();
  }, []);
  return (
    <ThemeProvider theme={dark ? darkTheme : lightTheme}>
      <GlobalStyle />
      {children}
    </ThemeProvider>
  );
}
