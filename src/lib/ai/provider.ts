import type { ClarifyError } from "@/lib/clarify";
import type { ClarifyOutput } from "@/lib/ai/clarifyPrompt";

/*
 * The contract every AI provider implements. A provider turns the provider-neutral
 * prompt into a ClarifyOutput (validated against OutputSchema) and translates its own
 * SDK errors into a ClarifyError. Nothing outside src/lib/ai/providers knows which
 * provider is in use.
 */

export type ClarifyRequest = { system: string; user: string };

export interface ClarifyProvider {
  /** Value of AI_PROVIDER that selects this provider, e.g. "anthropic". */
  id: string;
  /** Model actually used, for logs. */
  model: string;
  generate(request: ClarifyRequest): Promise<ClarifyOutput>;
}

/** A failure already translated into what the student sees, plus a safe line for the server log. */
export class ProviderError extends Error {
  constructor(
    readonly clarify: ClarifyError,
    readonly status: number,
    /** Error type, status and the provider's own reason. Never request or response content. */
    readonly logDetail: string,
  ) {
    super(clarify.message);
    this.name = "ProviderError";
  }
}

/** A provider factory: returns the provider, or the setup problem that stops it running. */
export type ProviderFactory = (env: NodeJS.ProcessEnv) => ClarifyProvider | { setupError: ClarifyError };
