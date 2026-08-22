const VILLAGE_TIME_ZONE = "America/Los_Angeles";
const VILLAGE_START_UTC = Date.UTC(2025, 3, 2);
const DAY_MS = 86_400_000;

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(Number.NaN);
  }

  return new Date(Date.UTC(year, month - 1, day));
}

export function dayNumber(date: string): number {
  const timestamp = parseIsoDate(date).getTime();
  return Math.floor((timestamp - VILLAGE_START_UTC) / DAY_MS) + 1;
}

export function formatDateLong(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(date));
}

export function formatDateShort(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(date));
}

export function formatDayLabel(date: string): string {
  return `Day ${dayNumber(date)} · ${formatDateShort(date)}`;
}

export function daySearchText(date: string): string {
  return `${date} ${formatDateLong(date)} day ${dayNumber(date)}`.toLowerCase();
}

export function formatVillageTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: VILLAGE_TIME_ZONE,
  }).format(new Date(timestamp));
}

export function formatMemoryTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: VILLAGE_TIME_ZONE,
  }).format(new Date(timestamp));
}

export function formatProfileTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: VILLAGE_TIME_ZONE,
  }).format(new Date(timestamp));
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function pluralizeMessages(value: number): string {
  return `${formatCount(value)} ${value === 1 ? "message" : "messages"}`;
}

export function pluralizeItems(value: number): string {
  return `${formatCount(value)} ${value === 1 ? "item" : "items"}`;
}
