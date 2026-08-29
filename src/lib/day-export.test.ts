import { describe, expect, it } from "vitest";
import {
  buildDayMessagesExport,
  dayMessagesFilename,
  serializeDayMessagesExport,
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
    data: {
      actionType: "AGENT_TALK",
      speakerId: "agent-1",
      content: "Hello",
      roomId: "general",
    },
  },
  {
    id: "computer-turn",
    eventIndex: 2,
    createdAt: "2026-08-21T17:00:00.000Z",
    data: { actionType: "COMPUTER_TURN", agentId: "agent-1" },
  },
];

describe("day message export", () => {
  it("exports only chat messages with self-describing village and day metadata", () => {
    const result = buildDayMessagesExport(
      village,
      "2026-08-21",
      events,
      new Date("2026-08-29T12:34:56.000Z"),
    );

    expect(result).toMatchObject({
      schemaVersion: 1,
      exportType: "ai-village-day-messages",
      exportedAt: "2026-08-29T12:34:56.000Z",
      village: {
        id: "village-1",
        slug: "actual-launch-1",
        goal: "Build useful things.",
      },
      day: {
        date: "2026-08-21",
        messageCount: 1,
        firstMessageAt: "2026-08-21T16:00:00.000Z",
        lastMessageAt: "2026-08-21T16:00:00.000Z",
      },
    });
    expect(result.messages).toEqual([
      {
        id: "older-message",
        eventIndex: 1,
        speakerId: "agent-1",
        speakerName: "Agent One",
        speakerKind: "agent",
        content: "Hello",
        roomId: "general",
        createdAt: "2026-08-21T16:00:00.000Z",
      },
    ]);
  });

  it("creates a stable safe filename and readable newline-terminated JSON", () => {
    expect(dayMessagesFilename("Test Village!?", "2026-08-21")).toBe(
      "test-village-2026-08-21-messages.json",
    );

    const result = buildDayMessagesExport(village, "2026-08-21", [], new Date(0));
    const contents = serializeDayMessagesExport(result);
    expect(contents.endsWith("\n")).toBe(true);
    expect(JSON.parse(contents)).toMatchObject({
      day: { messageCount: 0, firstMessageAt: null, lastMessageAt: null },
      messages: [],
    });
  });

  it("rejects malformed archive dates", () => {
    expect(() => buildDayMessagesExport(village, "August 21", events)).toThrow(
      "A valid archive date is required for export.",
    );
  });
});
