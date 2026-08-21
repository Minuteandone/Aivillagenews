import { describe, expect, it } from "vitest";
import { parseRelayedJson } from "./api";
import { dayNumber, formatDateLong, formatDayLabel } from "./format";
import {
  buildAgentOptions,
  buildRoomOptions,
  filterMessages,
  mapEventsToMessages,
} from "./messages";
import type { ApiAgent, ApiChatRoom, ApiEvent } from "../types";

const agents: ApiAgent[] = [
  { id: "agent-a", name: "Agent A" },
  { id: "agent-b", name: "Agent B" },
];

const rooms: ApiChatRoom[] = [
  { id: "general", name: "general" },
  { id: "old-room", name: "old-room", deletedAt: "2026-01-01T00:00:00.000Z" },
];

const events: ApiEvent[] = [
  {
    id: "event-2",
    eventIndex: 102,
    createdAt: "2026-08-21T17:03:00.000Z",
    data: {
      actionType: "AGENT_TALK",
      messageId: "message-2",
      speakerId: "agent-b",
      roomId: "old-room",
      content: "Second message",
    },
  },
  {
    id: "event-ignored",
    eventIndex: 101,
    createdAt: "2026-08-21T17:02:00.000Z",
    data: { actionType: "PAUSE", speakerId: "agent-a" },
  },
  {
    id: "event-1",
    eventIndex: 100,
    createdAt: "2026-08-21T17:01:00.000Z",
    data: {
      actionType: "AGENT_TALK",
      messageId: "message-1",
      speakerId: "agent-a",
      roomId: "general",
      content: "First message",
    },
  },
  {
    id: "event-human",
    eventIndex: 103,
    createdAt: "2026-08-21T17:04:00.000Z",
    data: {
      actionType: "USER_TALK",
      messageId: "message-human",
      speakerId: "human-a",
      speakerName: "Alex",
      roomId: "general",
      content: "Human message",
    },
  },
];

describe("relay parser", () => {
  it("parses a Jina-wrapped JSON response", () => {
    const result = parseRelayedJson<{ dates: string[] }>(
      'Title: \n\nURL Source: https://example.test\n\nMarkdown Content:\n{"dates":["2026-08-21"]}',
    );
    expect(result.dates).toEqual(["2026-08-21"]);
  });

  it("also accepts raw JSON", () => {
    expect(parseRelayedJson<{ ok: boolean }>("{\"ok\":true}")).toEqual({ ok: true });
  });
});

describe("village date formatting", () => {
  it("uses April 2, 2025 as Day 1", () => {
    expect(dayNumber("2025-04-02")).toBe(1);
    expect(dayNumber("2026-08-21")).toBe(507);
  });

  it("builds readable labels", () => {
    expect(formatDateLong("2026-08-21")).toBe("August 21, 2026");
    expect(formatDayLabel("2026-08-21")).toBe("Day 507 · Aug 21, 2026");
  });
});

describe("message mapping and filters", () => {
  const messages = mapEventsToMessages(events, agents);

  it("keeps only chat events and sorts oldest first", () => {
    expect(messages.map((message) => message.id)).toEqual([
      "message-1",
      "message-2",
      "message-human",
    ]);
  });

  it("retains deleted rooms that were active that day", () => {
    expect(buildRoomOptions(messages, rooms)).toEqual([
      { id: "general", name: "general", count: 2 },
      { id: "old-room", name: "old-room", count: 1 },
    ]);
  });

  it("offers agent-only filtering while leaving human posts in All agents", () => {
    expect(buildAgentOptions(messages, agents, "all")).toEqual([
      { id: "agent-a", name: "Agent A", count: 1 },
      { id: "agent-b", name: "Agent B", count: 1 },
    ]);
    expect(filterMessages(messages, "general", "all")).toHaveLength(2);
    expect(filterMessages(messages, "all", "agent-b").map((message) => message.id)).toEqual([
      "message-2",
    ]);
  });
});
