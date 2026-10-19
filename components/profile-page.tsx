"use client";

import { useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, KeyRound, LoaderCircle, LogOut, RefreshCw, Save, ShieldCheck, Sparkles, Trash2, Wheat } from "lucide-react";
import styled from "styled-components";
import { aiProviders, type AIProvider, type ProfileSummary } from "@/lib/profile-settings";
import { inventorySchema } from "@/lib/schemas";
import { useBrewStore } from "@/lib/store";
import * as Ui from "./ui";

const PageBody = styled.main`
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px;
  h1 { font-size: 28px; margin: 24px 0 4px; }
  @media (max-width: 640px) { padding: 24px 16px; }
`;
const ProfileSection = styled.section`
  padding: 32px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  scroll-margin-top: 20px;
  h2 { font-size: 18px; }
`;
const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 40px;
  margin-top: 20px;
  form { display: grid; gap: 18px; align-content: start; }
  @media (max-width: 700px) { grid-template-columns: minmax(0, 1fr); gap: 24px; }
`;
const Guide = styled.aside`
  border-left: 2px solid ${({ theme }) => theme.colors.border};
  padding-left: 24px;
  h3 { font-size: 13px; margin-bottom: 10px; }
  ol { margin: 0 0 16px; padding-left: 18px; }
  li { margin-bottom: 10px; color: ${({ theme }) => theme.colors.muted}; font-size: 12px; }
  a { color: ${({ theme }) => theme.colors.accent}; font-weight: 600; }
`;
const Notice = styled.p`
  padding: 12px 16px;
  margin-top: 20px;
  background: ${({ theme }) => theme.colors.accentSoft};
  border-left: 2px solid ${({ theme }) => theme.colors.accent};
`;
const Muted = styled.p`
  color: ${({ theme }) => theme.colors.muted};
  font-size: 12px;
  overflow-wrap: anywhere;
`;

async function request(path: string, method: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

export default function ProfilePage({ user, initialProfile }: Readonly<{
  user: { id: string; name: string; email: string };
  initialProfile: ProfileSummary;
}>) {
  const [profile, setProfile] = useState(initialProfile);
  const [provider, setProvider] = useState<AIProvider>(initialProfile.aiProvider);
  const [model, setModel] = useState(initialProfile.aiModel);
  const [aiKey, setAIKey] = useState("");
  const [brewfatherUserId, setBrewfatherUserId] = useState(initialProfile.brewfatherUserId);
  const [brewfatherVersion, setBrewfatherVersion] = useState<"v1" | "v2">(initialProfile.brewfatherVersion);
  const [brewfatherKey, setBrewfatherKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const selected = aiProviders[provider];

  async function save(section: "ai" | "brewfather", remove = false) {
    setBusy(section);
    setError("");
    setStatus("");
    const key = section === "ai" ? aiKey : brewfatherKey;
    const keyUpdate: { key?: string | null } = {};
    if (remove) keyUpdate.key = null;
    else if (key.trim()) keyUpdate.key = key.trim();
    const update = section === "ai"
      ? { section, provider, model }
      : { section, userId: brewfatherUserId, version: brewfatherVersion };
    try {
      const next: ProfileSummary = await request("/api/profile", "PATCH", {
        ...update,
        ...keyUpdate,
      });
      setProfile(next);
      if (section === "ai") setAIKey("");
      else setBrewfatherKey("");
      setStatus(remove ? "Saved key removed." : "Profile settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save profile settings.");
    } finally {
      setBusy(null);
    }
  }

  function submit(event: SyntheticEvent<HTMLFormElement>, section: "ai" | "brewfather") {
    event.preventDefault();
    void save(section);
  }

  async function syncInventory() {
    setBusy("sync"); setError(""); setStatus("");
    try {
      const result = await request("/api/brewfather/sync", "POST");
      const inventory = inventorySchema.parse(result.inventory);
      const store = useBrewStore.getState();
      store.clearAccountData(user.id);
      store.setInventory(inventory, "brewfather");
      setStatus(`Synced ${inventory.length} inventory items from Brewfather.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Inventory sync failed.");
    } finally { setBusy(null); }
  }

  async function signOut() {
    setBusy("signout"); setError("");
    try {
      await request("/api/auth/signout", "POST");
      useBrewStore.getState().clearAccountData(null);
      window.location.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed.");
      setBusy(null);
    }
  }

  return (
    <>
      <Ui.Header>
        <Ui.HeaderInner>
          <Ui.Brand as={Link} href="/">
            <Ui.Mark><Wheat size={23} aria-hidden="true" /></Ui.Mark>
            <div><strong>BrewLab.ai</strong><small>RECIPE STUDIO</small></div>
          </Ui.Brand>
          <Ui.Button as={Link} href="/"><ArrowLeft size={14} />Recipe Studio</Ui.Button>
        </Ui.HeaderInner>
      </Ui.Header>
      <PageBody>
        <Ui.Eyebrow>ACCOUNT</Ui.Eyebrow>
        <Ui.Row $between $wrap>
          <div><h1>Your profile</h1><Muted>{user.name} · {user.email}</Muted></div>
          <Ui.Button onClick={signOut} disabled={busy !== null}><LogOut size={14} />Sign out</Ui.Button>
        </Ui.Row>
        {!profile.encryptionConfigured && <Notice role="status">Secure credential storage needs to be configured on the server before API keys can be saved. Ask the administrator to set CREDENTIAL_ENCRYPTION_KEY.</Notice>}
        {error && <Ui.ErrorText role="alert">{error}</Ui.ErrorText>}
        {status && <Notice role="status">{status}</Notice>}

        <ProfileSection id="ai" aria-labelledby="ai-title">
          <Ui.Row $gap={10}><Sparkles size={19} /><h2 id="ai-title">AI connection</h2></Ui.Row>
          <SectionGrid>
            <form onSubmit={(event) => submit(event, "ai")}>
              <Ui.Field><span>AI provider</span>
                <select value={provider} disabled={busy !== null} onChange={(event) => {
                  const next = event.target.value as AIProvider;
                  setProvider(next);
                  setModel(next === profile.aiProvider ? profile.aiModel : aiProviders[next].model);
                  setAIKey("");
                }}>
                  {Object.entries(aiProviders).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                </select>
              </Ui.Field>
              <Ui.Field><span>Model</span>
                <input value={model} onChange={(event) => setModel(event.target.value)} required maxLength={120} spellCheck={false} disabled={busy !== null} />
              </Ui.Field>
              <Ui.Row $between $wrap><Ui.Field style={{ flex: 1 }}><span>{selected.label} API key</span>
                <input type="password" value={aiKey} onChange={(event) => setAIKey(event.target.value)} autoComplete="new-password" maxLength={4096} spellCheck={false} placeholder={profile.aiKeys[provider] ? "Leave blank to keep the saved key" : "Paste your API key"} disabled={busy !== null || !profile.encryptionConfigured} />
              </Ui.Field><Ui.Badge $tone={profile.aiKeys[provider] ? "green" : undefined}>{profile.aiKeys[provider] ? "Key saved" : "Not set"}</Ui.Badge></Ui.Row>
              <Ui.Row $wrap>
                <Ui.Button type="submit" $primary disabled={busy !== null || !profile.encryptionConfigured}>{busy === "ai" ? <LoaderCircle size={14} /> : <Save size={14} />}Save AI settings</Ui.Button>
                {profile.aiKeys[provider] && <Ui.Button type="button" onClick={() => save("ai", true)} disabled={busy !== null}><Trash2 size={14} />Remove saved key</Ui.Button>}
              </Ui.Row>
              <Muted><ShieldCheck size={14} /> Saved keys are encrypted and are never displayed again. API usage is billed by your selected provider.</Muted>
            </form>
            <Guide aria-label={`${selected.label} key instructions`}>
              <h3>Get a {selected.label} API key</h3>
              <ol>{selected.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <a href={selected.keyUrl} target="_blank" rel="noopener noreferrer">Open API key settings <ExternalLink size={13} /></a>
            </Guide>
          </SectionGrid>
        </ProfileSection>

        <ProfileSection id="brewfather" aria-labelledby="brewfather-title">
          <Ui.Row $gap={10}><KeyRound size={19} /><h2 id="brewfather-title">Brewfather</h2></Ui.Row>
          <SectionGrid>
            <form onSubmit={(event) => submit(event, "brewfather")}>
              <Ui.Field><span>Brewfather user ID</span>
                <input value={brewfatherUserId} onChange={(event) => setBrewfatherUserId(event.target.value)} maxLength={160} autoComplete="off" spellCheck={false} disabled={busy !== null} />
              </Ui.Field>
              <Ui.Field><span>API version</span>
                <select value={brewfatherVersion} onChange={(event) => setBrewfatherVersion(event.target.value as "v1" | "v2")} disabled={busy !== null}><option value="v2">v2</option><option value="v1">v1 (deprecated)</option></select>
              </Ui.Field>
              <Ui.Row $between $wrap><Ui.Field style={{ flex: 1 }}><span>Brewfather API key</span>
                <input type="password" value={brewfatherKey} onChange={(event) => setBrewfatherKey(event.target.value)} autoComplete="new-password" maxLength={256} spellCheck={false} placeholder={profile.brewfatherKeySaved ? "Leave blank to keep the saved key" : "Paste your API key"} disabled={busy !== null || !profile.encryptionConfigured} />
              </Ui.Field><Ui.Badge $tone={profile.brewfatherKeySaved ? "green" : undefined}>{profile.brewfatherKeySaved ? "Key saved" : "Not set"}</Ui.Badge></Ui.Row>
              <Ui.Row $wrap>
                <Ui.Button type="submit" $primary disabled={busy !== null || !profile.encryptionConfigured}>{busy === "brewfather" ? <LoaderCircle size={14} /> : <Save size={14} />}Save Brewfather settings</Ui.Button>
                {profile.brewfatherKeySaved && <Ui.Button type="button" onClick={() => save("brewfather", true)} disabled={busy !== null}><Trash2 size={14} />Remove saved key</Ui.Button>}
              </Ui.Row>
              <Ui.Button type="button" onClick={syncInventory} disabled={busy !== null || !profile.encryptionConfigured || !profile.brewfatherKeySaved || !profile.brewfatherUserId}>{busy === "sync" ? <LoaderCircle size={14} /> : <RefreshCw size={14} />}Sync inventory</Ui.Button>
            </form>
            <Guide aria-label="Brewfather key instructions">
              <h3>Get your Brewfather API credentials</h3>
              <ol><li>Open Brewfather, go to Settings, and find the API section.</li><li>Choose Generate and enable the inventory.read scope. Copy both the user ID and API key.</li><li>Save both values here before syncing. Brewfather v2 is recommended; API access requires an eligible Brewfather account.</li></ol>
              <a href="https://docs.brewfather.app/api" target="_blank" rel="noopener noreferrer">Brewfather API documentation <ExternalLink size={13} /></a>
            </Guide>
          </SectionGrid>
        </ProfileSection>
      </PageBody>
    </>
  );
}