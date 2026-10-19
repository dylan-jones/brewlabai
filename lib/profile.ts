import "server-only";
import { ApiError } from "./api";
import { decryptCredential, encryptCredential, isCredentialEncryptionConfigured } from "./credentials";
import { aiProviders, profileUpdateSchema, type AIProvider, type ProfileSummary } from "./profile-settings";
import type { WorkspaceDatabase } from "./workspace-db";

export async function getProfileSummary(workspace: WorkspaceDatabase): Promise<ProfileSummary> {
  const profile = await workspace.getProfile();
  return {
    aiProvider: profile?.ai_provider ?? "openai",
    aiModel: profile?.ai_model ?? aiProviders.openai.model,
    aiKeys: {
      openai: Boolean(profile?.openai_key),
      gemini: Boolean(profile?.gemini_key),
      anthropic: Boolean(profile?.anthropic_key),
    },
    brewfatherUserId: profile?.brewfather_user_id ?? "",
    brewfatherVersion: profile?.brewfather_version ?? "v2",
    brewfatherKeySaved: Boolean(profile?.brewfather_key),
    encryptionConfigured: isCredentialEncryptionConfigured(),
  };
}

export async function updateProfile(workspace: WorkspaceDatabase, userId: string, input: unknown) {
  const update = profileUpdateSchema.parse(input);
  if (typeof update.key === "string" && !isCredentialEncryptionConfigured())
    throw new ApiError("Secure credential storage is not configured on the server.", 503);
  const service = update.section === "ai" ? update.provider : "brewfather";
  const encrypted = typeof update.key === "string"
    ? await encryptCredential(update.key, userId, service)
    : update.key;
  if (update.section === "ai") {
    await workspace.saveAIProfile(update.provider, update.model, encrypted);
  } else {
    if (typeof update.key === "string" && !update.userId)
      throw new ApiError("Enter the Brewfather user ID shown with your API key.");
    await workspace.saveBrewfatherProfile(update.userId, update.version, encrypted);
  }
  return getProfileSummary(workspace);
}

export async function getAIConnection(workspace: WorkspaceDatabase, userId: string) {
  const profile = await workspace.getProfile();
  const provider: AIProvider = profile?.ai_provider ?? "openai";
  const encrypted = profile?.[`${provider}_key`];
  if (!encrypted) throw new ApiError("Add an API key for your selected AI provider in your profile.", 503);
  if (!isCredentialEncryptionConfigured()) throw new ApiError("Secure credential storage is not configured on the server.", 503);
  return {
    provider,
    model: profile?.ai_model ?? aiProviders[provider].model,
    apiKey: await decryptCredential(encrypted, userId, provider),
  };
}

export async function getBrewfatherConnection(workspace: WorkspaceDatabase, userId: string) {
  const profile = await workspace.getProfile();
  if (!profile?.brewfather_key || !profile.brewfather_user_id)
    throw new ApiError("Add your Brewfather user ID and API key in your profile before syncing.", 503);
  if (!isCredentialEncryptionConfigured()) throw new ApiError("Secure credential storage is not configured on the server.", 503);
  return {
    userId: profile.brewfather_user_id,
    version: profile.brewfather_version,
    apiKey: await decryptCredential(profile.brewfather_key, userId, "brewfather"),
  };
}