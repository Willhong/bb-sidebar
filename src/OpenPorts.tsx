import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { UrlLink, useRpc, type PluginSidebarThread } from "@get-bb/plugin-sdk/app";
import type { bbSidebarRpcContract } from "./server";
import { portsByEnvironment, type OpenPort } from "./open-ports";
import { Icon } from "./components/Icon";
import { portBrowserUrl } from "./port-links";
import { usePortLinkHost } from "./PortLinkSettings";

const OpenPortsContext = createContext<ReadonlyMap<string, readonly OpenPort[]>>(new Map());

export function OpenPortsProvider({ children }: { children: ReactNode }) {
  const rpc = useRpc<typeof bbSidebarRpcContract>();
  const [ports, setPorts] = useState<ReadonlyMap<string, readonly OpenPort[]>>(new Map());

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const snapshot = await rpc.call("getOpenPorts", {});
        if (!disposed) setPorts(portsByEnvironment(snapshot));
      } catch {
        // An unavailable scanner must not leave stale indicators behind.
        if (!disposed) setPorts(new Map());
      } finally {
        if (!disposed) timer = setTimeout(refresh, 10_000);
      }
    }
    void refresh();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [rpc]);

  return <OpenPortsContext.Provider value={ports}>{children}</OpenPortsContext.Provider>;
}

function useThreadPorts(thread: PluginSidebarThread) {
  const byEnvironment = useContext(OpenPortsContext);
  return thread.environment?.id ? byEnvironment.get(thread.environment.id) : undefined;
}

export function OpenPortDetails({ thread }: { thread: PluginSidebarThread }) {
  const ports = useThreadPorts(thread);
  const localHostId = usePortLinkHost();
  if (!ports?.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 text-xs font-normal leading-4 text-muted-foreground">
      <div className="flex items-center gap-2">
        <Icon name="Plug" className="size-3.5 shrink-0" aria-hidden />
        <span>Workspace ports ({ports.length})</span>
      </div>
      <div
        role={ports.length > 4 ? "region" : undefined}
        aria-label={ports.length > 4 ? "Workspace port list" : undefined}
        tabIndex={ports.length > 4 ? 0 : undefined}
        data-port-scroll={ports.length > 4 ? "" : undefined}
        className={ports.length > 4
          ? "pointer-events-auto flex max-h-[min(12rem,30dvh)] flex-col gap-1.5 overflow-y-auto rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          : "flex flex-col gap-1.5"}
      >
      {ports.map((port) => {
        const url = portBrowserUrl(port, thread.host?.id, localHostId);
        return (
        <div key={port.port} className="min-w-0 pl-5 text-xs leading-4">
          <div className="break-words">
            {url ? <UrlLink
              href={url}
              aria-label={`Open port ${port.port}`}
              onClick={(event) => event.stopPropagation()}
              className="pointer-events-auto rounded-sm underline decoration-muted-foreground/40 underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              :{port.port}
            </UrlLink> : <span>:{port.port}</span>}
            {" "}{port.service ?? port.container ?? port.processName ?? "TCP listener"}
          </div>
          <div className="break-all text-[11px] text-muted-foreground">
            {port.address ? `${port.address} · ` : ""}
            {port.source === "docker" ? `Docker${port.container ? ` · ${port.container}` : ""}` : port.pid ? `PID ${port.pid}` : "TCP"}
          </div>
        </div>
        );
      })}
      </div>
    </div>
  );
}

export function OpenPortsIndicator({ thread }: { thread: PluginSidebarThread }) {
  const ports = useThreadPorts(thread);
  if (!ports?.some((port) => port.ownerThreadId === thread.id)) return null;
  return (
    <span
      role="img"
      aria-label="Open ports started by this thread"
      className="pointer-events-none relative flex shrink-0 items-center text-muted-foreground/60"
    >
      <Icon name="Plug" aria-hidden className="size-3" />
    </span>
  );
}
