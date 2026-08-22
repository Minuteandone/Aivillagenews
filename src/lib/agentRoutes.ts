import { agentPageSlug } from "./api";

export interface AgentHashRoute {
  slug: string;
  memory: boolean;
}

export function parseAgentHash(hash: string): AgentHashRoute | null {
  const match = hash.match(/^#agent\/([^/]+)(?:\/(memory))?$/);
  if (!match?.[1]) return null;

  try {
    return { slug: decodeURIComponent(match[1]), memory: match[2] === "memory" };
  } catch {
    return null;
  }
}

export function agentHash(name: string, memory = false): string {
  return `#agent/${encodeURIComponent(agentPageSlug(name))}${memory ? "/memory" : ""}`;
}
