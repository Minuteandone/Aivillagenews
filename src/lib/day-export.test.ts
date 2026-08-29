import { describe, expect, it } from "vitest";
import {
  buildDayEventsExport,
  dayEventsFilename,
  serializeDayEventsExport,
} from "./dayExport";
import type { ApiEvent, VillageData } from "../types";

const village: VillageData = {
  id: "village-1",
  slug: "actual-launch-1",
  name: "Actual Launch",
  villageGoal: "Build useful things.",
  agents: [{ id: "agent-1", name: "Agent One" }],
  rooms: [{ id: "general", name: "general" }],
  dates: ["2026-08-21"],
  latestDate: "2026-08-21",
  latestMessages: [],
};

const events: ApiEvent[] = [
  {
    id: "newer-pause",
    eventIndex: 3,
    createdAt: "2026-08-21T18:05:00.000Z",
    data: { actionType: "PAUSE", agentId: "agent-1", seconds: 60 },
  },
  {
    id: "older-message",
    eventIndex: 1,
    createdAt: "2026-08-21T16:00:00.000Z",
    data: { actionType: "AGENT_TALK", speakerId: "agent-1", content: "Hello" },
  },
  {
    id: "computer-turn",
    eventIndex: 2,
    createdAt: "2026-08-21T17:00:00.000Z",
    data: { actionType: "COMPUTER_TURN", agentId: "agent-1" },
  },
];

describe("day event export", () => {
  it("wraps every raw event with self-describing village and day metadata", () => {
    const result = buildDayEventsExport(
      village,
      "2026-08-21",
      events,
      new Date("2026-08-29T12:34:56.000Z"),
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      exportType: "ai-village-day-events",
      exportedAt: "2026-08-29T12:34:56.000Z",
      village: {
        id: "village-1",
        slug: "actual-launch-1",
        goal: "Build useful things.",
      },
      day: {
        date: "2026-08-21",
        eventCount: 3,
        firstEventAt: "2026-08-21T16:00:00.000Z",
        lastEventAt: "2026-08-21T18:05:00.000Z",
      },
    });
    expect(result.events).toEqual(events);
    expect(result.events.map((event) => event.data.actionType)).toEqual([
      "PAUSE",
      "AGENT_TALK",
      "COMPUTER_TURN",
    ]);
  });

  it("creates a stable safe filename and readable newline-terminated JSON", () => {
    expect(dayEventsFilename("Test Village!?", "2026-08-21")).toBe(
      "test-village-2026-08-21-events.json",
    );

    const result = buildDayEventsExport(village, "2026-08-21", [], new Date(0));
    const contents = serializeDayEventsExport(result);
    expect(contents.endsWith("\n")).toBe(true);
    expect(JSON.parse(contents)).toMatchObject({
      day: { eventCount: 0, firstEventAt: null, lastEventAt: null },
      events: [],
    });
  });

  it("rejects malformed archive dates", () => {
    expect(() => buildDayEventsExport(village, "August 21", events)).toThrow(
      "A valid archive date is required for export.",
    );
  });
});
