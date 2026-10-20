import { renderToStaticMarkup } from "react-dom/server";
import { LoaderCircle } from "lucide-react";
import { ServerStyleSheet } from "styled-components";
import { describe, expect, it, vi } from "vitest";
import Providers from "./providers";

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));

describe("shared loading indicators", () => {
  it("animates loader icons globally and disables rotation for reduced motion", () => {
    const sheet = new ServerStyleSheet();
    try {
      const markup = renderToStaticMarkup(sheet.collectStyles(<Providers><LoaderCircle /></Providers>));
      const css = sheet.getStyleTags();
      expect(markup).toContain("lucide-loader-circle");
      expect(css).toContain(".lucide-loader-circle,.lucide-loader,.lucide-loader-2{animation:");
      expect(css).toContain(".8s linear infinite");
      expect(css).toContain("rotate(360deg)");
      expect(css).toContain("prefers-reduced-motion: reduce");
      expect(css).toContain(".lucide-loader-circle,.lucide-loader,.lucide-loader-2{animation:none;");
    } finally {
      sheet.seal();
    }
  });
});