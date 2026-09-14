import { describe, expect, it, vi } from "vitest";
import { createFakePluginHost, makeThreadResponse } from "@get-bb/plugin-sdk/testing";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { createPortDiscovery } from "./port-discovery";

type Environment = Awaited<ReturnType<BbPluginApi["sdk"]["environments"]["get"]>>;

describe("sidebar port discovery", () => {
  it("scans each host, shares concurrent results, and drops failed hosts on refresh", async () => {
    let offline = false;
    const scan = vi.fn(async ({ hostId }: { hostId: string }) => {
      if (offline) throw new Error("Host offline");
      return { ports: [
        { environmentId: hostId === "host_a" ? "env_a" : "env_b", port: 3000, processName: "node", pid: 1234, address: "127.0.0.1", source: "process", ownerThreadId: "a" },
        { environmentId: "unrequested", port: 9999 },
      ] };
    });
    const { bb, harness } = createFakePluginHost({
      experimental_callHostRpc: scan,
      sdk: {
        threads: { list: async () => [
          makeThreadResponse({ id: "a", environmentId: "env_a" }),
          makeThreadResponse({ id: "a2", environmentId: "env_a" }),
          makeThreadResponse({ id: "b", environmentId: "env_b" }),
        ] },
        environments: { get: async ({ environmentId }) => ({
          id: environmentId, status: "ready", path: `/workspace/${environmentId}`,
          hostId: environmentId === "env_a" ? "host_a" : "host_b",
        }) as Environment },
      },
    });
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    try {
      const discover = createPortDiscovery(bb);
      const [first, second] = await Promise.all([discover(), discover()]);
      expect(first).toEqual(second);
      expect(first.groups.map((group) => group.environmentId).sort()).toEqual(["env_a", "env_b"]);
      expect(first.groups.find((group) => group.environmentId === "env_a")?.ports[0]).toEqual({ port: 3000, processName: "node", pid: 1234, address: "127.0.0.1", source: "process", ownerThreadId: "a" });
      expect(first.groups.find((group) => group.environmentId === "env_b")?.ports[0].ownerThreadId).toBeUndefined();
      expect(scan).toHaveBeenCalledTimes(2);
      await discover();
      expect(scan).toHaveBeenCalledTimes(2);
      offline = true;
      clock.mockReturnValue(111_000);
      expect(await discover()).toEqual({ groups: [] });
      expect(scan).toHaveBeenCalledTimes(4);
    } finally {
      clock.mockRestore();
      await harness.lifecycle.dispose();
    }
  });
});
