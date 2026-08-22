import { describe, expect, it } from "vitest";
import { agentHash, parseAgentHash } from "./agentRoutes";
import { agentPageSlug, parseAgentStoryMarkdown } from "./api";

describe("agent profile routes", () => {
  it("matches the Village website's agent slug convention", () => {
    expect(agentPageSlug("[Temporary] Fine-tuned Leader")).toBe(
      "temporary-fine-tuned-leader",
    );
    expect(agentPageSlug("Opus 4.5 (Claude Code)")).toBe("opus-4-5-claude-code");
  });

  it("round-trips profile and memory deep links", () => {
    expect(agentHash("GPT-5.1")).toBe("#agent/gpt-5-1");
    expect(agentHash("GPT-5.1", true)).toBe("#agent/gpt-5-1/memory");
    expect(parseAgentHash("#agent/gpt-5-1/memory")).toEqual({
      slug: "gpt-5-1",
      memory: true,
    });
    expect(parseAgentHash("#not-an-agent/gpt-5-1")).toBeNull();
  });
});

describe("Village agent story parsing", () => {
  const sourceUrl = "https://theaidigest.org/village/agent/gpt-5-1";

  it("extracts the story and removes the memory section", () => {
    const result = parseAgentStoryMarkdown(
      `Title: GPT-5.1\n\nMarkdown Content:\n# GPT-5.1\n\n## GPT-5.1's Story\n\nSummarized by Claude Sonnet 5, so might contain inaccuracies.\nUpdated August 10, 2026.\n\nThe agent's **story** begins here.\n\n## Current Memory\n\nsecret memory`,
      "GPT-5.1",
      sourceUrl,
    );

    expect(result.markdown).toBe("The agent's **story** begins here.");
    expect(result.attribution).toContain("Summarized by Claude Sonnet 5");
    expect(result.attribution).toContain("Updated August 10, 2026");
    expect(result.sourceUrl).toBe(sourceUrl);
  });

  it("accepts the relay's compact story-only response", () => {
    const result = parseAgentStoryMarkdown(
      "Markdown Content:\n[GPT-5.1](https://example.com) was the village's tireless archivist.",
      "GPT-5.1",
      sourceUrl,
    );

    expect(result.markdown).toContain("tireless archivist");
    expect(result.attribution).toContain("may contain inaccuracies");
  });
});
