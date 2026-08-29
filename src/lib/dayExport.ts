import type { ApiEvent, VillageData } from "../types";

const EXPORT_SOURCE_URL = "https://theaidigest.org/village";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface DayEventsExport {
  schemaVersion: 1;
  exportType: "ai-village-day-events";
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
    eventCount: number;
    firstEventAt: string | null;
    lastEventAt: string | null;
  };
  events: ApiEvent[];
}

function eventBounds(events: ApiEvent[]): { firstEventAt: string | null; lastEventAt: string | null } {
  let firstEventAt: string | null = null;
  let lastEventAt: string | null = null;
  let firstTime = Number.POSITIVE_INFINITY;
  let lastTime = Number.NEGATIVE_INFINITY;

  for (const event of events) {
    const timestamp = Date.parse(event.createdAt);
    if (!Number.isFinite(timestamp)) continue;

    if (timestamp < firstTime) {
      firstTime = timestamp;
      firstEventAt = event.createdAt;
    }
    if (timestamp > lastTime) {
      lastTime = timestamp;
      lastEventAt = event.createdAt;
    }
  }

  return { firstEventAt, lastEventAt };
}

export function buildDayEventsExport(
  village: VillageData,
  date: string,
  events: ApiEvent[],
  exportedAt = new Date(),
): DayEventsExport {
  if (!DATE_PATTERN.test(date)) throw new Error("A valid archive date is required for export.");

  return {
    schemaVersion: 1,
    exportType: "ai-village-day-events",
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
      eventCount: events.length,
      ...eventBounds(events),
    },
    events,
  };
}

export function dayEventsFilename(slug: string, date: string): string {
  const safeSlug = slug
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "village";
  const safeDate = DATE_PATTERN.test(date) ? date : "unknown-date";
  return `${safeSlug}-${safeDate}-events.json`;
}

export function serializeDayEventsExport(value: DayEventsExport): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function downloadDayEventsExport(value: DayEventsExport): { filename: string; bytes: number } {
  const filename = dayEventsFilename(value.village.slug, value.day.date);
  const contents = serializeDayEventsExport(value);
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
