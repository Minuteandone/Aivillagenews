import { describe, expect, it } from "vitest";
import {
  buildGitAuthorOptions,
  buildGitProjectOptions,
  filterGitCommits,
  getVillageDayBounds,
  isGitLabProjectCandidate,
  mapGitHubCommit,
  mapGitLabCommit,
} from "./gitHistory";
import type { GitCommit } from "../types";

const githubCommit = mapGitHubCommit({
  sha: "aaaaaaaa11111111",
  html_url: "https://github.com/ai-village-agents/news/commit/aaaaaaaa11111111",
  url: "https://api.github.com/repos/ai-village-agents/news/commits/aaaaaaaa11111111",
  commit: {
    message: "Publish village update\n\nAdds the daily digest.",
    author: {
      name: "GPT-5.2",
      email: "gpt-5.2@agentvillage.org",
      date: "2026-08-21T18:00:00Z",
    },
    committer: {
      name: "GPT-5.2",
      email: "gpt-5.2@agentvillage.org",
      date: "2026-08-21T18:01:00Z",
    },
  },
  author: { login: "village-gpt52", avatar_url: "https://example.com/avatar.png" },
  committer: null,
  parents: [{ sha: "parent111" }],
  repository: {
    id: 1,
    name: "news",
    full_name: "ai-village-agents/news",
    html_url: "https://github.com/ai-village-agents/news",
  },
});

const gitlabProject = {
  id: 42,
  name: "Village Museum",
  path_with_namespace: "ai-village-agents/village/museum",
  web_url: "https://gitlab.com/ai-village-agents/village/museum",
  default_branch: "main",
  created_at: "2026-08-20T15:00:00Z",
  last_activity_at: "2026-08-21T20:00:00Z",
  empty_repo: false,
};

const gitlabCommit = mapGitLabCommit(gitlabProject, {
  id: "bbbbbbbb22222222",
  short_id: "bbbbbbbb",
  title: "Repair exhibit links",
  message: "Repair exhibit links",
  author_name: "Claude Opus 4.8",
  author_email: "opus@agentvillage.org",
  authored_date: "2026-08-21T19:00:00Z",
  committed_date: "2026-08-21T19:05:00Z",
  web_url: "https://gitlab.com/ai-village-agents/village/museum/-/commit/bbbbbbbb22222222",
  parent_ids: ["parent222"],
});

describe("Git history date boundaries", () => {
  it("uses the Village's Pacific day in summer and winter", () => {
    const summer = getVillageDayBounds("2026-08-21");
    expect(summer.start.toISOString()).toBe("2026-08-21T07:00:00.000Z");
    expect(summer.endExclusive.toISOString()).toBe("2026-08-22T07:00:00.000Z");

    const winter = getVillageDayBounds("2026-12-21");
    expect(winter.start.toISOString()).toBe("2026-12-21T08:00:00.000Z");
    expect(winter.endExclusive.toISOString()).toBe("2026-12-22T08:00:00.000Z");
  });
});

describe("Git history mapping", () => {
  it("maps GitHub search results into a common commit shape", () => {
    expect(githubCommit).toMatchObject({
      platform: "github",
      projectPath: "ai-village-agents/news",
      title: "Publish village update",
      authorName: "GPT-5.2",
      authorUsername: "village-gpt52",
      shortSha: "aaaaaaaa",
    });
  });

  it("maps GitLab commits into the same common shape", () => {
    expect(gitlabCommit).toMatchObject({
      platform: "gitlab",
      projectId: "42",
      projectPath: "ai-village-agents/village/museum",
      title: "Repair exhibit links",
      authorName: "Claude Opus 4.8",
      shortSha: "bbbbbbbb",
    });
  });

  it("selects only GitLab projects that could contain commits for the day", () => {
    const { start, endExclusive } = getVillageDayBounds("2026-08-21");
    expect(isGitLabProjectCandidate(gitlabProject, start, endExclusive)).toBe(true);
    expect(
      isGitLabProjectCandidate(
        { ...gitlabProject, created_at: "2026-08-22T10:00:00Z" },
        start,
        endExclusive,
      ),
    ).toBe(false);
    expect(
      isGitLabProjectCandidate(
        { ...gitlabProject, default_branch: null },
        start,
        endExclusive,
      ),
    ).toBe(false);
  });
});

describe("Git history filters", () => {
  const commits: GitCommit[] = [githubCommit, gitlabCommit];
  const bothSources = { github: true, gitlab: true };

  it("builds project and author options with counts", () => {
    expect(buildGitProjectOptions(commits, bothSources)).toHaveLength(2);
    expect(buildGitAuthorOptions(commits, bothSources, "all")).toEqual([
      { id: "claude opus 4.8", name: "Claude Opus 4.8", count: 1 },
      { id: "gpt-5.2", name: "GPT-5.2", count: 1 },
    ]);
  });

  it("filters by source, project, author, search text, and sort order", () => {
    expect(
      filterGitCommits(commits, {
        sources: { github: false, gitlab: true },
        projectId: "all",
        authorId: "all",
        search: "exhibit",
        sort: "desc",
      }),
    ).toEqual([gitlabCommit]);

    expect(
      filterGitCommits(commits, {
        sources: bothSources,
        projectId: "github:ai-village-agents/news",
        authorId: "gpt-5.2",
        search: "aaaaaaaa",
        sort: "asc",
      }),
    ).toEqual([githubCommit]);

    expect(
      filterGitCommits(commits, {
        sources: bothSources,
        projectId: "all",
        authorId: "all",
        search: "",
        sort: "asc",
      }).map((commit) => commit.platform),
    ).toEqual(["github", "gitlab"]);
  });
});
