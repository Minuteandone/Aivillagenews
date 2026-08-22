import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("browser connection policy", () => {
  it("allows every public API used by the archive", () => {
    const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
    const policy = html.match(/http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/)?.[1];

    expect(policy).toContain("https://theaidigest.org");
    expect(policy).toContain("https://r.jina.ai");
    expect(policy).toContain("https://api.github.com");
    expect(policy).toContain("https://gitlab.com");
  });
});
