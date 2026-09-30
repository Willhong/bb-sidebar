import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

/** Optional integration: a catch must never delay or fail the shelf move. */
export function createPokemonCatchNotifier(bb: BbPluginApi) {
  const lifetime = new AbortController();
  bb.onDispose(() => lifetime.abort());

  return (threadId: string): void => {
    const send = async () => {
      const request = {
        pluginId: "pokemon",
        method: "catchSettledThread",
        input: { threadId },
        outputSchema: z.object({ caught: z.boolean() }).strict(),
        signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(30_000)]),
      };
      await bb.sdk.plugins.callRpc(request);
    };
    void send().catch((error: unknown) => {
      if (lifetime.signal.aborted) return;
      bb.log.debug(`Pokémon catch skipped for ${threadId}: ${error instanceof Error ? error.message : String(error)}`);
    });
  };
}
