type SystemText = { type: 'text'; text: string };
type CachedSystemText = SystemText & {
  cache_control?: { type: 'ephemeral'; ttl: '5m' };
};

/** Cache only the existing system prefix, never a member's answers or photo.
 * Anthropic also includes preceding tools in this prefix. Request-specific tool
 * schemas must match for a hit; keep their validation bounds intact.
 * Short prefixes are ignored by Anthropic. Never pad prompts to reach a minimum.
 */
export function cacheSystemPrompt(system: string | readonly SystemText[]): CachedSystemText[] {
  const blocks: readonly SystemText[] =
    typeof system === 'string' ? [{ type: 'text', text: system }] : system;
  return blocks.map((block, index) => ({
    ...block,
    ...(index === blocks.length - 1
      ? { cache_control: { type: 'ephemeral' as const, ttl: '5m' as const } }
      : {}),
  }));
}

const tokenCount = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

export function promptCacheUsage(usage: unknown) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return undefined;
  const value = usage as Record<string, unknown>;
  const uncachedInputTokens = tokenCount(value.input_tokens);
  if (uncachedInputTokens === undefined) return undefined;
  const cacheReadInputTokens = tokenCount(value.cache_read_input_tokens) ?? 0;
  const cacheCreationInputTokens = tokenCount(value.cache_creation_input_tokens) ?? 0;
  return {
    uncachedInputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    totalInputTokens: uncachedInputTokens + cacheReadInputTokens + cacheCreationInputTokens,
    outputTokens: tokenCount(value.output_tokens),
  };
}

/** Token-only diagnostics: no prompts, member identifiers, photos or credentials. */
export function logPromptCacheUsage(operation: string, model: string, usage: unknown) {
  const counts = promptCacheUsage(usage);
  if (counts) console.info('[AI prompt cache]', { operation, model, ...counts });
}
