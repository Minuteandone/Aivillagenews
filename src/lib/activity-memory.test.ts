import { describe, expect, it } from "vitest";
import { buildTimelineItems, mapEventsToActivities } from "./activities";
import { compactDiffLines, diffLines } from "./diff";
import type { ApiAgent, ApiChatRoom, ApiEvent, ChatMessage } from "../types";

const agents: ApiAgent[] = [
  { id: "agent-a", name: "Agent A" },
  { id: "agent-b", name: "Agent B" },
];

const rooms: ApiChatRoom[] = [
  { id: "general", name: "general" },
  { id: "research", name: "research" },
];

const events: ApiEvent[] = [
  {
    id: "chat",
    eventIndex: 1,
    createdAt: "2026-08-21T17:00:00.000Z",
    data: { actionType: "AGENT_TALK", speakerId: "agent-a", content: "Hello" },
  },
  {
    id: "pause",
    eventIndex: 3,
    createdAt: "2026-08-21T17:02:00.000Z",
    data: { actionType: "PAUSE", agentId: "agent-a", roomId: "general", seconds: 120 },
  },
  {
    id: "consolidate",
    eventIndex: 4,
    createdAt: "2026-08-21T17:03:00.000Z",
    data: {
      actionType: "CONSOLIDATE",
      agentId: "agent-b",
      roomName: "research",
      nextSessionGoal: "Check the primary source",
    },
  },
  {
    id: "search",
    eventIndex: 5,
    createdAt: "2026-08-21T17:04:00.000Z",
    data: { actionType: "SEARCH_HISTORY", agentId: "agent-a", query: "prior decision" },
  },
  {
    id: "computer",
    eventIndex: 6,
    createdAt: "2026-08-21T17:05:00.000Z",
    data: { actionType: "COMPUTER_TURN", agentId: "agent-a" },
  },
];

const message: ChatMessage = {
  id: "message",
  eventIndex: 2,
  speakerId: "agent-a",
  speakerName: "Agent A",
  speakerKind: "agent",
  content: "A message between events",
  roomId: "general",
  createdAt: "2026-08-21T17:01:00.000Z",
};

describe("action timeline", () => {
  const activities = mapEventsToActivities(events, agents, rooms);

  it("keeps useful actions while excluding chat and computer turns", () => {
    expect(activities.map((activity) => activity.id)).toEqual([
      "pause",
      "consolidate",
      "search",
    ]);
    expect(activities[0]?.summary).toBe("Agent A paused for 2 minutes.");
    expect(activities[1]).toMatchObject({
      kind: "consolidation",
      roomId: "research",
      detail: "Next: Check the primary source",
    });
  });

  it("combines messages and enabled actions chronologically", () => {
    const timeline = buildTimelineItems(
      [message],
      activities,
      { messages: true, pauses: true, consolidations: false, otherActions: false },
      "all",
      "all",
    );

    expect(timeline.map((item) => (item.kind === "message" ? item.message.id : item.activity.id))).toEqual([
      "message",
      "pause",
    ]);
  });

  it("applies the existing room and agent filters to actions", () => {
    const timeline = buildTimelineItems(
      [message],
      activities,
      { messages: false, pauses: true, consolidations: true, otherActions: true },
      "research",
      "agent-b",
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0]?.kind).toBe("activity");
    if (timeline[0]?.kind === "activity") expect(timeline[0].activity.id).toBe("consolidate");
  });
});

describe("memory line diff", () => {
  it("identifies additions, removals, and unchanged lines", () => {
    const lines = diffLines("alpha\nbeta\ngamma", "alpha\nbeta edited\ngamma\ndelta");
    expect(lines.map((line) => [line.kind, line.content])).toEqual([
      ["equal", "alpha"],
      ["removed", "beta"],
      ["added", "beta edited"],
      ["equal", "gamma"],
      ["added", "delta"],
    ]);
  });

  it("treats an empty previous memory as entirely new", () => {
    expect(diffLines("", "first\nsecond").map((line) => line.kind)).toEqual([
      "added",
      "added",
    ]);
  });

  it("collapses distant unchanged sections while preserving context", () => {
    const oldContent = Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n");
    const newContent = oldContent.replace("line 10", "line ten");
    const compact = compactDiffLines(diffLines(oldContent, newContent), 1);
    expect(compact.some((line) => line.kind === "separator")).toBe(true);
    expect(compact.some((line) => line.content === "line ten")).toBe(true);
  });
});
