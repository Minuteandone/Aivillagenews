import { mapEventsToMessages } from "./messages";
import type { ApiEvent, ChatMessage, VillageData } from "../types";

const EXPORT_SOURCE_URL = "https://theaidigest.org/village";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DayMessagesExport {
  schemaVersion: 1;
  exportType: "ai-village-day-messages";
  exportedAt: string;
  sourceUrl: string;
  village: {
    id: string;
    slug: string;
    name: string;
    goal: string | null;
    agents: VillageData["agents"];
    rooms: VillageData["rooms"];
  };
  day: {
    date: string;
    messageCount: number;
    firstMessageAt: string | null;
    lastMessageAt: string | null;
  };
  messages: ChatMessage[];
}

function messageBounds(messages: ChatMessage[]): {
  firstMessageAt: string | null;
  lastMessageAt: string | null;
} {
  let firstMessageAt: string | null = null;
  let lastMessageAt: string | null = null;
  let firstTime = Number.POSITIVE_INFINITY;
  let lastTime = Number.NEGATIVE_INFINITY;

  for (const message of messages) {
    const timestamp = Date.parse(message.createdAt);
    if (!Number.isFinite(timestamp)) continue;

    if (timestamp < firstTime) {
      firstTime = timestamp;
      firstMessageAt = message.createdAt;
    }
    if (timestamp > lastTime) {
      lastTime = timestamp;
      lastMessageAt = message.createdAt;
    }
  }

  return { firstMessageAt, lastMessageAt };
}

export function buildDayMessagesExport(
  village: VillageData,
  date: string,
  events: ApiEvent[],
  exportedAt = new Date(),
): DayMessagesExport {
  if (!DATE_PATTERN.test(date)) throw new Error("A valid archive date is required for export.");
  const messages = mapEventsToMessages(events, village.agents);

  return {
    schemaVersion: 1,
    exportType: "ai-village-day-messages",
    exportedAt: exportedAt.toISOString(),
    sourceUrl: EXPORT_SOURCE_URL,
    village: {
      id: village.id,
      slug: village.slug,
      name: village.name,
      goal: village.villageGoal ?? null,
      agents: village.agents,
      rooms: village.rooms,
    },
    day: {
      date,
      messageCount: messages.length,
      ...messageBounds(messages),
    },
    messages,
  };
}

export function dayMessagesFilename(slug: string, date: string): string {
  const safeSlug = slug
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "village";
  const safeDate = DATE_PATTERN.test(date) ? date : "unknown-date";
  return `${safeSlug}-${safeDate}-messages.json`;
}

export function serializeDayMessagesExport(value: DayMessagesExport): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function downloadDayMessagesExport(value: DayMessagesExport): {
  filename: string;
  bytes: number;
} {
  const filename = dayMessagesFilename(value.village.slug, value.day.date);
  const contents = serializeDayMessagesExport(value);
  const blob = new Blob([contents], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);

  return { filename, bytes: blob.size };
}
