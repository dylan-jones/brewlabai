import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "styled-components";
import { describe, expect, it, vi } from "vitest";
import { lightTheme } from "../lib/theme";
import { aiProviders, type AIProvider, type ProfileSummary } from "../lib/profile-settings";
import ProfilePage from "./profile-page";

vi.mock("idb-keyval", () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/profile-settings", () => import("../lib/profile-settings"));
vi.mock("@/lib/schemas", () => import("../lib/schemas"));
vi.mock("@/lib/store", () => import("../lib/store"));

function renderProfile(provider: AIProvider, encryptionConfigured = true) {
  const profile: ProfileSummary = {
    aiProvider: provider, aiModel: aiProviders[provider].model,
    aiKeys: { openai: true, gemini: true, anthropic: true },
    brewfatherUserId: "brewer-id", brewfatherVersion: "v2", brewfatherKeySaved: true, encryptionConfigured,
  };
  return renderToStaticMarkup(<ThemeProvider theme={lightTheme}>
    <ProfilePage user={{ id: "brewer", name: "Brewer", email: "brewer@example.com" }} initialProfile={profile} />
  </ThemeProvider>);
}

describe("profile connection settings", () => {
  it.each<AIProvider>(["openai", "gemini", "anthropic"])("shows the matching %s key instructions", (provider) => {
    const markup = renderProfile(provider);
    expect(markup).toContain(aiProviders[provider].keyUrl);
    expect(markup).toContain(aiProviders[provider].model);
    expect(markup.match(/type="password"/g)).toHaveLength(2);
    expect(markup.match(/value=""/g)).toHaveLength(2);
    expect(markup).toContain("inventory.read");
    expect(markup).not.toContain("<dialog");
  });

  it("explains when encrypted storage is unavailable", () => {
    expect(renderProfile("openai", false)).toContain("Secure credential storage needs to be configured");
  });
});