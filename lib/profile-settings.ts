import { z } from "zod";

export const aiProviders = {
  openai: {
    label: "GPT (OpenAI)",
    model: "gpt-4.1-mini",
    keyUrl: "https://platform.openai.com/api-keys",
    steps: [
      "Sign in to the OpenAI API platform and select your project.",
      "Open API keys, choose Create new secret key, and copy the key when it is shown.",
      "Enable API billing or credits for the project. A ChatGPT subscription does not include API usage.",
    ],
  },
  gemini: {
    label: "Gemini (Google)",
    model: "gemini-3.8-flash",
    keyUrl: "https://aistudio.google.com/api-keys",
    steps: [
      "Sign in to Google AI Studio and open the API keys page.",
      "Choose Create API key and select or create a Google Cloud project. Import an existing project into AI Studio if needed.",
      "Copy the key and enable billing if your chosen model or usage tier requires it. Use a key restricted to the Gemini API.",
    ],
  },
  anthropic: {
    label: "Claude (Anthropic)",
    model: "claude-sonnet-5.5",
    keyUrl: "https://platform.claude.com/settings/keys",
    steps: [
      "Sign in to Claude Console and select your workspace.",
      "Open Settings, then API keys, choose Create key, and copy the key.",
      "Add API credits or configure billing. A Claude chat subscription is separate from API billing.",
    ],
  },
} as const;

export const aiProviderSchema = z.enum(["openai", "gemini", "anthropic"]);
export type AIProvider = z.infer<typeof aiProviderSchema>;

const apiKey = z.string().trim().min(1).max(4096).regex(/^[\x21-\x7E]+$/);
export const profileUpdateSchema = z.discriminatedUnion("section", [
  z.object({
    section: z.literal("ai"),
    provider: aiProviderSchema,
    model: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/),
    key: apiKey.nullable().optional(),
  }).strict(),
  z.object({
    section: z.literal("brewfather"),
    userId: z.string().trim().max(160).regex(/^[a-zA-Z0-9_-]*$/),
    version: z.enum(["v1", "v2"]),
    key: apiKey.max(256).nullable().optional(),
  }).strict(),
]);

export interface ProfileSummary {
  aiProvider: AIProvider;
  aiModel: string;
  aiKeys: Record<AIProvider, boolean>;
  brewfatherUserId: string;
  brewfatherVersion: "v1" | "v2";
  brewfatherKeySaved: boolean;
  encryptionConfigured: boolean;
}