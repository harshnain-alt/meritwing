import type { z } from "zod";
import type { ClarifyError } from "@/lib/clarify";

/*
 * The contract every AI provider implements. A provider sends a provider-neutral prompt,
 * returns output validated against the task's Zod schema, and translates its own SDK
 * errors into a ClarifyError (the error shape shared by every AI feature). Nothing outside
 * src/lib/ai/providers knows which provider is in use.
 */

export type AiRequest<T> = {
  system: string;
  user: string;
  /** Shape of the output. The provider validates against it before returning. */
  schema: z.ZodType<T>;
  /** Most items to request for top-level array properties, where the provider can enforce it. */
  arrayLimits?: Record<string, number>;
};

export interface AiProvider {
  /** Value of AI_PROVIDER that selects this provider, e.g. "anthropic". */
  id: string;
  /** Model actually used, for logs. */
  model: string;
  generate<T>(request: AiRequest<T>): Promise<T>;
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

/** Shown when a provider answered but the output can't be used. */
export const NO_RESULT: ClarifyError = {
  code: "no_result",
  retryable: true,
  message: "The AI didn't return a usable result this time. Try again.",
};

/** A provider factory: returns the provider, or the setup problem that stops it running. */
export type ProviderFactory = (env: NodeJS.ProcessEnv) => AiProvider | { setupError: ClarifyError };
