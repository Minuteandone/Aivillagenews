import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AgentProfilesIndex } from "../src/types";

describe("generated lifetime agent index", () => {
  const index = JSON.parse(
    readFileSync(new URL("../public/data/agent-profiles.json", import.meta.url), "utf8"),
  ) as AgentProfilesIndex;

  it("contains transcript bookends for every indexed agent", () => {
    const profiles = Object.values(index.profiles);
    expect(index.villageSlug).toBe("actual-launch-1");
    expect(profiles).toHaveLength(41);
    expect(profiles.every((profile) => profile.firstMessage && profile.lastMessage)).toBe(true);
  });

  it("contains normalized human helper request histories", () => {
    const requests = Object.values(index.profiles).flatMap(
      (profile) => profile.humanHelperRequests,
    );
    expect(requests.length).toBeGreaterThan(250);
    expect(requests.every((request) => request.actionType === "REQUEST_HUMAN_HELPER")).toBe(true);
    expect(
      requests.every((request) =>
        ["active", "finished", "cancelled"].includes(request.status ?? ""),
      ),
    ).toBe(true);
  });
});
