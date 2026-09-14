import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { portScanContract, type PortRoot } from "./port-scan-contract";
import type { PortSnapshot } from "./open-ports";

export function createPortDiscovery(bb: BbPluginApi): () => Promise<PortSnapshot> {
  const host = bb.hosts.experimental_client({ contract: portScanContract });
  const controller = new AbortController();
  bb.onDispose(() => controller.abort());
  let cached: PortSnapshot = { groups: [] };
  let scannedAt = 0;
  let pending: Promise<PortSnapshot> | null = null;

  async function scan(): Promise<PortSnapshot> {
    const ids = new Set<string>();
    const threadEnvironment = new Map<string, string>();
    for (let offset = 0; ; offset += 500) {
      const threads = await bb.sdk.threads.list({ archived: false, includeHidden: true, limit: 500, offset, signal: controller.signal });
      for (const thread of threads) if (thread.environmentId) {
        ids.add(thread.environmentId);
        threadEnvironment.set(thread.id, thread.environmentId);
      }
      if (threads.length < 500) break;
    }
    const byHost = new Map<string, PortRoot[]>();
    await Promise.all([...ids].map(async (environmentId) => {
      try {
        const env = await bb.sdk.environments.get({ environmentId });
        if (env.status !== "ready" || !env.path) return;
        const roots = byHost.get(env.hostId) ?? [];
        roots.push({ environmentId, path: env.path });
        byHost.set(env.hostId, roots);
      } catch { /* Deleted or inaccessible environment. */ }
    }));
    const groups: PortSnapshot["groups"] = [];
    await Promise.all([...byHost].map(async ([hostId, roots]) => {
      try {
        const result = await host.call("scan", { roots }, {
          hostId, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
        });
        for (const root of roots) {
          const ports = result.ports.filter((port) => port.environmentId === root.environmentId).map(({ environmentId: _, ownerThreadId, ...port }) => ({
            ...port,
            ...(ownerThreadId && threadEnvironment.get(ownerThreadId) === root.environmentId ? { ownerThreadId } : {}),
          }));
          if (ports.length) groups.push({ environmentId: root.environmentId, ports });
        }
      } catch (error) {
        bb.log.debug(`Port scan failed on ${hostId}: ${String(error)}`);
      }
    }));
    return { groups };
  }

  return () => {
    if (pending) return pending;
    if (Date.now() - scannedAt < 10_000) return Promise.resolve(cached);
    pending = scan().then((snapshot) => {
      cached = snapshot;
      scannedAt = Date.now();
      return snapshot;
    }).finally(() => { pending = null; });
    return pending;
  };
}
