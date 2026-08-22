import { mapCurrentMessages, mapEventsToMessages } from "./messages";
import type {
  ApiEventsResponse,
  ApiEvent,
  ApiMemoriesResponse,
  ApiVillage,
  ApiVillageSummary,
  ChatMessage,
  MemoryPair,
  MemoryVersion,
  VillageData,
} from "../types";

const API_ORIGIN = "https://theaidigest.org/village";
const RELAY_PREFIX = "https://r.jina.ai/";

type Transport = "auto" | "direct" | "relay";

let transport: Transport = import.meta.env.DEV
  ? "direct"
  : typeof window !== "undefined" && window.location.hostname === "theaidigest.org"
    ? "direct"
    : "relay";
const dayCache = new Map<string, ChatMessage[]>();
const eventCache = new Map<string, ApiEvent[]>();
const memoryCache = new Map<string, MemoryVersion[]>();

export class VillageApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "VillageApiError";
  }
}

function getErrorMessage(value: unknown, fallback: string): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }

  return fallback;
}

export function parseRelayedJson<T>(text: string): T {
  const marker = "Markdown Content:";
  const markerIndex = text.indexOf(marker);
  const jsonText = markerIndex >= 0 ? text.slice(markerIndex + marker.length).trim() : text;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new VillageApiError("The public data relay returned an unreadable response.");
  }
}

async function fetchDirect<T>(path: string, signal?: AbortSignal): Promise<T> {
  const url = import.meta.env.DEV ? `/village-api${path}` : `${API_ORIGIN}${path}`;
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  const value = (await response.json()) as T;

  if (!response.ok) {
    throw new VillageApiError(
      getErrorMessage(value, `The AI Village API returned ${response.status}.`),
      response.status,
    );
  }

  return value;
}

async function fetchViaRelay<T>(path: string, signal?: AbortSignal): Promise<T> {
  const targetUrl = `${API_ORIGIN}${path}`;
  const response = await fetch(`${RELAY_PREFIX}${targetUrl}`, {
    signal,
    headers: { Accept: "text/plain" },
  });

  if (!response.ok) {
    throw new VillageApiError(
      response.status === 429
        ? "The public data relay is temporarily rate-limited. Please wait a minute and retry."
        : `The public data relay returned ${response.status}.`,
      response.status,
    );
  }

  return parseRelayedJson<T>(await response.text());
}

async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (transport === "relay") return fetchViaRelay<T>(path, signal);

  try {
    const value = await fetchDirect<T>(path, signal);
    transport = "direct";
    return value;
  } catch (error) {
    if (error instanceof VillageApiError || signal?.aborted || import.meta.env.DEV) {
      throw error;
    }

    transport = "relay";
    return fetchViaRelay<T>(path, signal);
  }
}

export function activeTransport(): Exclude<Transport, "auto"> | "checking" {
  return transport === "auto" ? "checking" : transport;
}

export async function loadVillage(
  rawSlug: string,
  signal?: AbortSignal,
): Promise<VillageData> {
  const slug = rawSlug.trim();

  if (!slug) throw new VillageApiError("Enter a village slug first.");

  const summary = await requestJson<ApiVillageSummary>(
    `/api/villages?slug=${encodeURIComponent(slug)}`,
    signal,
  );

  if (!summary.id || summary.error) {
    throw new VillageApiError(summary.error ?? `No village was found for “${slug}”.`, 404);
  }

  const [village, datesResponse] = await Promise.all([
    requestJson<ApiVillage>(`/api/villages/${encodeURIComponent(summary.id)}`, signal),
    requestJson<{ dates?: string[]; error?: string }>(
      `/api/villages/${encodeURIComponent(summary.id)}/active-dates`,
      signal,
    ),
  ]);

  const dates = [...(datesResponse.dates ?? [])].sort();

  if (dates.length === 0) {
    throw new VillageApiError(`The village “${slug}” does not have any active days yet.`);
  }

  const latestDate = dates.at(-1) as string;
  const latestMessages = mapCurrentMessages(village.chatMessages ?? [], village.agents ?? []);
  dayCache.set(`${village.id}:${latestDate}`, latestMessages);

  return {
    id: village.id,
    slug: village.slug,
    name: village.name,
    agents: village.agents ?? [],
    rooms: village.chatRooms ?? [],
    dates,
    latestDate,
    latestMessages,
  };
}

export async function loadDayMessages(
  village: VillageData,
  date: string,
  signal?: AbortSignal,
): Promise<ChatMessage[]> {
  const cacheKey = `${village.id}:${date}`;
  const cached = dayCache.get(cacheKey);

  if (cached) return cached;

  const events = await loadDayEvents(village.id, date, signal);
  const messages = mapEventsToMessages(events, village.agents);
  dayCache.set(cacheKey, messages);
  return messages;
}

export function getCachedDayEvents(villageId: string, date: string): ApiEvent[] | null {
  return eventCache.get(`${villageId}:${date}`) ?? null;
}

export async function loadDayEvents(
  villageId: string,
  date: string,
  signal?: AbortSignal,
): Promise<ApiEvent[]> {
  const cacheKey = `${villageId}:${date}`;
  const cached = eventCache.get(cacheKey);
  if (cached) return cached;

  const response = await requestJson<ApiEventsResponse>(
    `/api/events?villageId=${encodeURIComponent(villageId)}&date=${encodeURIComponent(date)}&page=1`,
    signal,
  );

  if (response.error) throw new VillageApiError(response.error);

  const events = response.events ?? [];
  eventCache.set(cacheKey, events);
  return events;
}

export async function loadAgentMemories(
  agentId: string,
  beforeTimestamp?: number,
  signal?: AbortSignal,
): Promise<MemoryVersion[]> {
  const cutoff = beforeTimestamp === undefined ? "latest" : Math.floor(beforeTimestamp).toString();
  const cacheKey = `${agentId}:${cutoff}`;
  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  const query = beforeTimestamp === undefined ? "" : `?createdAt=${encodeURIComponent(cutoff)}`;
  const response = await requestJson<ApiMemoriesResponse>(
    `/api/agent/${encodeURIComponent(agentId)}/memories${query}`,
    signal,
  );

  if (response.error) throw new VillageApiError(response.error);

  const memories = [...(response.memories ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  memoryCache.set(cacheKey, memories);
  return memories;
}

export async function loadConsolidationMemoryPair(
  agentId: string,
  consolidationTimestamp: string,
  signal?: AbortSignal,
): Promise<MemoryPair> {
  const eventTime = new Date(consolidationTimestamp).getTime();
  const versions = await loadAgentMemories(agentId, eventTime + 1000, signal);
  const currentIndex = versions.findIndex(
    (version) => new Date(version.createdAt).getTime() <= eventTime + 1000,
  );
  const current = versions[currentIndex];

  if (!current) {
    throw new VillageApiError("No saved memory was found for this consolidation.");
  }

  return {
    current,
    previous: versions[currentIndex + 1] ?? null,
  };
}
