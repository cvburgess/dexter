import type { LanguageModelV3 } from "@ai-sdk/provider";

/**
 * Typed mock implementing the AI SDK `LanguageModelV3` spec.
 *
 * Mirrors `MockLanguageModelV3` from `ai/test`, which cannot be used directly:
 * that entry point imports vitest and msw at module load, both tied to the
 * Vitest runtime, and neither works under `deno test`.
 *
 * Records every `doGenerate` invocation in `doGenerateCalls` so tests can assert
 * call counts and inspect prompts without ad-hoc tracking flags.
 *
 * Ported from the same helper in magic-meal-kit, which is where this repo's AI
 * SDK conventions come from.
 */
export class MockLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider: string;
  readonly modelId: string;
  readonly supportedUrls: LanguageModelV3["supportedUrls"];
  readonly doGenerate: LanguageModelV3["doGenerate"];
  readonly doStream: LanguageModelV3["doStream"];
  readonly doGenerateCalls: Parameters<LanguageModelV3["doGenerate"]>[0][] = [];

  constructor(
    opts: {
      provider?: string;
      modelId?: string;
      doGenerate?: LanguageModelV3["doGenerate"];
      doStream?: LanguageModelV3["doStream"];
    } = {},
  ) {
    this.provider = opts.provider ?? "mock-provider";
    this.modelId = opts.modelId ?? "mock-model-id";
    this.supportedUrls = {};

    const generate = opts.doGenerate ??
      (() => Promise.reject(new Error("doGenerate not implemented")));
    this.doGenerate = (options) => {
      this.doGenerateCalls.push(options);
      return generate(options);
    };

    this.doStream = opts.doStream ??
      (() => Promise.reject(new Error("doStream not implemented")));
  }
}

/** The result metadata `doGenerate` must return alongside its content. */
export const mockGenerateMeta = {
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 },
  },
  warnings: [] as never[],
};

/**
 * A model that answers every call with `object` serialized as its completion
 * text — which is where `generateText` + `Output.object` reads the result from.
 */
export function objectModel(object: unknown): MockLanguageModel {
  return new MockLanguageModel({
    doGenerate: () =>
      Promise.resolve({
        content: [{ type: "text" as const, text: JSON.stringify(object) }],
        ...mockGenerateMeta,
      }),
  });
}
