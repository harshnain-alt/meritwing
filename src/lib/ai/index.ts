import type { ClarifyError } from "@/lib/clarify";
import type { ClarifyProvider, ProviderFactory } from "@/lib/ai/provider";
import { createAnthropicProvider } from "@/lib/ai/providers/anthropic";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";

/*
 * Chooses the AI provider from AI_PROVIDER (default "gemini"). There is no automatic
 * fallback between providers: only the selected one is ever called.
 * To add a provider: implement ProviderFactory in src/lib/ai/providers/<name>.ts,
 * register it below, and document its environment variables in .env.example.
 */

const PROVIDERS: Record<string, ProviderFactory> = {
  gemini: createGeminiProvider,
  anthropic: createAnthropicProvider,
};

export const DEFAULT_PROVIDER = "gemini";

export function getClarifyProvider(env: NodeJS.ProcessEnv = process.env): ClarifyProvider | { setupError: ClarifyError } {
  const id = (env.AI_PROVIDER?.trim() || DEFAULT_PROVIDER).toLowerCase();
  const factory = PROVIDERS[id];
  if (!factory) {
    return {
      setupError: {
        code: "not_configured",
        retryable: false,
        message: `AI questions aren't set up on this server: AI_PROVIDER is “${id}”, which isn't supported. Supported: ${Object.keys(PROVIDERS).join(", ")}.`,
      },
    };
  }
  return factory(env);
}
