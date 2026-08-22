import type {
  GitAuthorOption,
  GitCommit,
  GitCommitDetail,
  GitCommitFile,
  GitFileChangeType,
  GitHistoryResult,
  GitHistorySourceResult,
  GitPlatform,
  GitProjectOption,
} from "../types";

export const GITHUB_ORG = "ai-village-agents";
export const GITLAB_GROUP_ID = "136149641";

const GITHUB_API = "https://api.github.com";
const GITLAB_API = "https://gitlab.com/api/v4";
const PAGE_SIZE = 100;
const MAX_GITHUB_PAGES = 10;
const MAX_GITLAB_PROJECT_PAGES = 20;
const MAX_GITLAB_CANDIDATES = 240;
const MAX_GITLAB_COMMIT_PAGES = 3;
const MAX_PATCH_LENGTH = 12_000;
const gitHistoryCache = new Map<string, GitHistoryResult>();
const gitCommitDetailCache = new Map<string, GitCommitDetail>();

interface GitHubSearchCommit {
  sha: string;
  html_url: string;
  url: string;
  commit: {
    message: string;
    author: { name: string; email?: string | null; date: string } | null;
    committer: { name: string; email?: string | null; date: string } | null;
  };
  author: { login: string; avatar_url?: string | null } | null;
  committer: { login: string; avatar_url?: string | null } | null;
  parents?: Array<{ sha: string }>;
  repository: {
    id: number;
    name: string;
    full_name: string;
    html_url: string;
  };
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubSearchCommit[];
}

interface GitHubCommitDetailResponse {
  stats?: { total: number; additions: number; deletions: number };
  files?: Array<{
    sha: string;
    filename: string;
    previous_filename?: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
    blob_url?: string;
    patch?: string;
  }>;
  commit?: {
    verification?: { verified: boolean; reason?: string | null };
  };
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  default_branch: string | null;
  created_at: string;
  last_activity_at: string;
  empty_repo?: boolean;
}

interface GitLabCommitResponse {
  id: string;
  short_id: string;
  title: string;
  message: string;
  author_name: string;
  author_email?: string | null;
  authored_date: string;
  committer_name?: string | null;
  committer_email?: string | null;
  committed_date: string;
  web_url: string;
  parent_ids?: string[];
  stats?: { total: number; additions: number; deletions: number };
}

interface GitLabDiffResponse {
  old_path: string;
  new_path: string;
  a_mode?: string;
  b_mode?: string;
  new_file: boolean;
  renamed_file: boolean;
  deleted_file: boolean;
  generated_file?: boolean;
  collapsed?: boolean;
  too_large?: boolean;
  diff?: string;
}

interface GitHistoryFilters {
  sources: Record<GitPlatform, boolean>;
  projectId: string;
  authorId: string;
  search: string;
  sort: "asc" | "desc";
}

interface GitHubLoadResult {
  commits: GitCommit[];
  totalCount: number;
  partial: boolean;
}

interface GitLabLoadResult {
  commits: GitCommit[];
  scannedProjects: number;
  totalCandidateProjects: number;
  partial: boolean;
  failedProjects: number;
}

export class GitHistoryApiError extends Error {
  constructor(
    message: string,
    public readonly platform: GitPlatform,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "GitHistoryApiError";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function apiMessage(value: unknown, fallback: string): string {
  if (typeof value === "object" && value !== null && "message" in value) {
    const message = value.message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

async function requestExternalJson<T>(
  url: string,
  platform: GitPlatform,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, {
      signal,
      headers:
        platform === "github"
          ? {
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            }
          : { Accept: "application/json" },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new GitHistoryApiError(
      `${platform === "github" ? "GitHub" : "GitLab"} could not be reached from this browser.`,
      platform,
    );
  }

  const value = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const isRateLimit = response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0";
    const fallback = isRateLimit
      ? `${platform === "github" ? "GitHub" : "GitLab"}'s public API rate limit was reached. Try again in a few minutes.`
      : `${platform === "github" ? "GitHub" : "GitLab"} returned ${response.status}.`;
    throw new GitHistoryApiError(apiMessage(value, fallback), platform, response.status);
  }

  return value as T;
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const valueFor = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const representedAsUtc = Date.UTC(
    valueFor("year"),
    valueFor("month") - 1,
    valueFor("day"),
    valueFor("hour"),
    valueFor("minute"),
    valueFor("second"),
  );
  return representedAsUtc - date.getTime();
}

function localDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = target;
  for (let pass = 0; pass < 2; pass += 1) {
    guess = target - getTimeZoneOffset(new Date(guess), timeZone);
  }
  return new Date(guess);
}

export function getVillageDayBounds(date: string): { start: Date; endExclusive: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new GitHistoryApiError("The selected day is not a valid archive date.", "github");

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const timeZone = "America/Los_Angeles";

  return {
    start: localDateTimeToUtc(year, month, day, timeZone),
    endExclusive: localDateTimeToUtc(
      nextDate.getUTCFullYear(),
      nextDate.getUTCMonth() + 1,
      nextDate.getUTCDate(),
      timeZone,
    ),
  };
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0]?.trim() || "Untitled commit";
}

export function mapGitHubCommit(item: GitHubSearchCommit): GitCommit {
  const author = item.commit.author ?? item.commit.committer;
  const committer = item.commit.committer ?? author;
  const account = item.author ?? item.committer;

  return {
    id: `github:${item.repository.full_name}:${item.sha}`,
    platform: "github",
    sha: item.sha,
    shortSha: item.sha.slice(0, 8),
    projectId: item.repository.full_name,
    projectPath: item.repository.full_name,
    projectName: item.repository.name,
    title: firstLine(item.commit.message),
    message: item.commit.message.trim(),
    authorName: author?.name ?? account?.login ?? "Unknown author",
    authorUsername: account?.login ?? null,
    authorEmail: author?.email ?? null,
    avatarUrl: account?.avatar_url ?? null,
    authoredAt: author?.date ?? committer?.date ?? new Date(0).toISOString(),
    committedAt: committer?.date ?? author?.date ?? new Date(0).toISOString(),
    webUrl: item.html_url,
    parentShas: item.parents?.map((parent) => parent.sha) ?? [],
    refName: null,
  };
}

export function mapGitLabCommit(project: GitLabProject, item: GitLabCommitResponse): GitCommit {
  return {
    id: `gitlab:${project.id}:${item.id}`,
    platform: "gitlab",
    sha: item.id,
    shortSha: item.short_id || item.id.slice(0, 8),
    projectId: String(project.id),
    projectPath: project.path_with_namespace,
    projectName: project.name,
    title: item.title?.trim() || firstLine(item.message),
    message: item.message.trim(),
    authorName: item.author_name || item.committer_name || "Unknown author",
    authorUsername: null,
    authorEmail: item.author_email ?? item.committer_email ?? null,
    avatarUrl: null,
    authoredAt: item.authored_date,
    committedAt: item.committed_date,
    webUrl: item.web_url,
    parentShas: item.parent_ids ?? [],
    refName: null,
  };
}

async function loadGitHubCommits(date: string, signal?: AbortSignal): Promise<GitHubLoadResult> {
  const { start, endExclusive } = getVillageDayBounds(date);
  const endInclusive = new Date(endExclusive.getTime() - 1_000);
  const query = `org:${GITHUB_ORG} committer-date:${start.toISOString()}..${endInclusive.toISOString()}`;
  const commits: GitCommit[] = [];
  let totalCount = 0;
  let incomplete = false;

  for (let page = 1; page <= MAX_GITHUB_PAGES; page += 1) {
    const params = new URLSearchParams({
      q: query,
      sort: "committer-date",
      order: "desc",
      per_page: String(PAGE_SIZE),
      page: String(page),
    });
    const response = await requestExternalJson<GitHubSearchResponse>(
      `${GITHUB_API}/search/commits?${params.toString()}`,
      "github",
      signal,
    );

    totalCount = response.total_count;
    incomplete ||= response.incomplete_results;
    commits.push(...response.items.map(mapGitHubCommit));
    if (response.items.length < PAGE_SIZE || commits.length >= totalCount) break;
  }

  return {
    commits: dedupeAndSortCommits(commits),
    totalCount,
    partial: incomplete || totalCount > PAGE_SIZE * MAX_GITHUB_PAGES,
  };
}

export function isGitLabProjectCandidate(
  project: GitLabProject,
  start: Date,
  endExclusive: Date,
): boolean {
  if (!project.default_branch || project.empty_repo) return false;
  const createdAt = new Date(project.created_at).getTime();
  const lastActivityAt = new Date(project.last_activity_at).getTime();
  return createdAt < endExclusive.getTime() && lastActivityAt >= start.getTime();
}

async function loadGitLabCandidateProjects(
  date: string,
  signal?: AbortSignal,
): Promise<{ projects: GitLabProject[]; listTruncated: boolean }> {
  const { start, endExclusive } = getVillageDayBounds(date);
  const projects: GitLabProject[] = [];
  let listTruncated = false;

  for (let page = 1; page <= MAX_GITLAB_PROJECT_PAGES; page += 1) {
    const params = new URLSearchParams({
      include_subgroups: "true",
      with_shared: "false",
      simple: "true",
      order_by: "last_activity_at",
      sort: "desc",
      per_page: String(PAGE_SIZE),
      page: String(page),
    });
    const response = await requestExternalJson<GitLabProject[]>(
      `${GITLAB_API}/groups/${GITLAB_GROUP_ID}/projects?${params.toString()}`,
      "gitlab",
      signal,
    );

    projects.push(
      ...response.filter((project) => isGitLabProjectCandidate(project, start, endExclusive)),
    );

    const oldestActivity = response.at(-1)?.last_activity_at;
    const reachedSelectedDay = oldestActivity
      ? new Date(oldestActivity).getTime() < start.getTime()
      : true;
    if (response.length < PAGE_SIZE || reachedSelectedDay) break;
    if (page === MAX_GITLAB_PROJECT_PAGES) listTruncated = true;
  }

  return { projects, listTruncated };
}

async function loadGitLabProjectCommits(
  project: GitLabProject,
  date: string,
  signal?: AbortSignal,
): Promise<{ commits: GitCommit[]; truncated: boolean }> {
  const { start, endExclusive } = getVillageDayBounds(date);
  const commits: GitCommit[] = [];
  let truncated = false;

  for (let page = 1; page <= MAX_GITLAB_COMMIT_PAGES; page += 1) {
    const params = new URLSearchParams({
      all: "true",
      since: start.toISOString(),
      until: new Date(endExclusive.getTime() - 1).toISOString(),
      per_page: String(PAGE_SIZE),
      page: String(page),
    });
    const response = await requestExternalJson<GitLabCommitResponse[]>(
      `${GITLAB_API}/projects/${project.id}/repository/commits?${params.toString()}`,
      "gitlab",
      signal,
    );
    commits.push(...response.map((commit) => mapGitLabCommit(project, commit)));
    if (response.length < PAGE_SIZE) break;
    if (page === MAX_GITLAB_COMMIT_PAGES) truncated = true;
  }

  return { commits, truncated };
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index] as T, index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function loadGitLabCommits(
  date: string,
  signal?: AbortSignal,
  onProgress?: (message: string) => void,
): Promise<GitLabLoadResult> {
  onProgress?.("Finding active GitLab projects…");
  const { projects: allCandidates, listTruncated } = await loadGitLabCandidateProjects(
    date,
    signal,
  );
  const projects = allCandidates.slice(0, MAX_GITLAB_CANDIDATES);
  let completed = 0;

  const projectResults = await mapWithConcurrency(projects, 8, async (project) => {
    try {
      return await loadGitLabProjectCommits(project, date, signal);
    } catch (error) {
      if (isAbortError(error)) throw error;
      return { commits: [] as GitCommit[], truncated: false, failed: true };
    } finally {
      completed += 1;
      if (completed === projects.length || completed % 8 === 0) {
        onProgress?.(`Scanning GitLab projects ${completed} of ${projects.length}…`);
      }
    }
  });

  const failedProjects = projectResults.filter((result) => "failed" in result).length;
  const commitPagesTruncated = projectResults.some((result) => result.truncated);
  const commits = projectResults.flatMap((result) => result.commits);
  const candidateLimitReached = allCandidates.length > projects.length;

  return {
    commits: dedupeAndSortCommits(commits),
    scannedProjects: projects.length,
    totalCandidateProjects: allCandidates.length,
    failedProjects,
    partial:
      listTruncated || candidateLimitReached || commitPagesTruncated || failedProjects > 0,
  };
}

function sourceError(platform: GitPlatform, reason: unknown): GitHistorySourceResult {
  const label = platform === "github" ? "GitHub" : "GitLab";
  return {
    platform,
    status: "error",
    count: 0,
    detail: reason instanceof Error ? reason.message : `${label} history could not be loaded.`,
  };
}

export async function loadGitHistory(
  date: string,
  signal?: AbortSignal,
  onProgress?: (message: string) => void,
  force = false,
): Promise<GitHistoryResult> {
  if (!force) {
    const cached = gitHistoryCache.get(date);
    if (cached) return cached;
  }

  onProgress?.("Loading GitHub and GitLab history…");
  const [githubResult, gitlabResult] = await Promise.allSettled([
    loadGitHubCommits(date, signal),
    loadGitLabCommits(date, signal, onProgress),
  ]);
  if (signal?.aborted) throw new DOMException("The request was aborted.", "AbortError");

  const commits: GitCommit[] = [];
  const warnings: string[] = [];
  const sources: GitHistorySourceResult[] = [];
  let githubTotalCount = 0;
  let scannedGitLabProjects = 0;
  let totalGitLabCandidateProjects = 0;

  if (githubResult.status === "fulfilled") {
    commits.push(...githubResult.value.commits);
    githubTotalCount = githubResult.value.totalCount;
    sources.push({
      platform: "github",
      status: githubResult.value.partial ? "partial" : "loaded",
      count: githubResult.value.commits.length,
      detail: githubResult.value.partial
        ? `Showing ${githubResult.value.commits.length.toLocaleString()} of ${githubResult.value.totalCount.toLocaleString()} searchable default-branch commits.`
        : "Default-branch commits loaded from the public organization search.",
    });
    if (githubResult.value.partial) {
      warnings.push("GitHub capped or marked this search as incomplete, so some commits may be missing.");
    }
  } else {
    if (isAbortError(githubResult.reason)) throw githubResult.reason;
    sources.push(sourceError("github", githubResult.reason));
    warnings.push(sourceError("github", githubResult.reason).detail);
  }

  if (gitlabResult.status === "fulfilled") {
    commits.push(...gitlabResult.value.commits);
    scannedGitLabProjects = gitlabResult.value.scannedProjects;
    totalGitLabCandidateProjects = gitlabResult.value.totalCandidateProjects;
    sources.push({
      platform: "gitlab",
      status: gitlabResult.value.partial ? "partial" : "loaded",
      count: gitlabResult.value.commits.length,
      detail: `Scanned ${gitlabResult.value.scannedProjects.toLocaleString()} active projects in group ${GITLAB_GROUP_ID}.`,
    });
    if (gitlabResult.value.partial) {
      warnings.push(
        gitlabResult.value.failedProjects > 0
          ? `${gitlabResult.value.failedProjects} GitLab project request${gitlabResult.value.failedProjects === 1 ? "" : "s"} failed; the remaining history is still shown.`
          : "GitLab hit a safety cap while scanning unusually large project history.",
      );
    }
  } else {
    if (isAbortError(gitlabResult.reason)) throw gitlabResult.reason;
    sources.push(sourceError("gitlab", gitlabResult.reason));
    warnings.push(sourceError("gitlab", gitlabResult.reason).detail);
  }

  const result: GitHistoryResult = {
    commits: dedupeAndSortCommits(commits),
    sources,
    warnings: [...new Set(warnings)],
    githubTotalCount,
    scannedGitLabProjects,
    totalGitLabCandidateProjects,
  };
  gitHistoryCache.set(date, result);
  return result;
}

function projectKey(commit: GitCommit): string {
  return `${commit.platform}:${commit.projectId}`;
}

function authorKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

export function buildGitProjectOptions(
  commits: GitCommit[],
  sources: Record<GitPlatform, boolean>,
): GitProjectOption[] {
  const options = new Map<string, GitProjectOption>();

  for (const commit of commits) {
    if (!sources[commit.platform]) continue;
    const id = projectKey(commit);
    const current = options.get(id);
    if (current) current.count += 1;
    else {
      options.set(id, {
        id,
        platform: commit.platform,
        name: commit.projectName,
        path: commit.projectPath,
        count: 1,
      });
    }
  }

  return [...options.values()].sort(
    (a, b) => b.count - a.count || a.path.localeCompare(b.path),
  );
}

export function buildGitAuthorOptions(
  commits: GitCommit[],
  sources: Record<GitPlatform, boolean>,
  selectedProjectId: string,
): GitAuthorOption[] {
  const options = new Map<string, GitAuthorOption>();

  for (const commit of commits) {
    if (!sources[commit.platform]) continue;
    if (selectedProjectId !== "all" && projectKey(commit) !== selectedProjectId) continue;
    const id = authorKey(commit.authorName);
    const current = options.get(id);
    if (current) current.count += 1;
    else options.set(id, { id, name: commit.authorName, count: 1 });
  }

  return [...options.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

export function filterGitCommits(
  commits: GitCommit[],
  filters: GitHistoryFilters,
): GitCommit[] {
  const search = filters.search.trim().toLocaleLowerCase();
  const filtered = commits.filter((commit) => {
    if (!filters.sources[commit.platform]) return false;
    if (filters.projectId !== "all" && projectKey(commit) !== filters.projectId) return false;
    if (filters.authorId !== "all" && authorKey(commit.authorName) !== filters.authorId) return false;
    if (!search) return true;

    return [
      commit.title,
      commit.message,
      commit.projectPath,
      commit.authorName,
      commit.authorUsername ?? "",
      commit.sha,
    ].some((value) => value.toLocaleLowerCase().includes(search));
  });

  return [...filtered].sort((a, b) => {
    const difference = new Date(a.committedAt).getTime() - new Date(b.committedAt).getTime();
    return filters.sort === "asc" ? difference : -difference;
  });
}

export function dedupeAndSortCommits(commits: GitCommit[]): GitCommit[] {
  const unique = new Map<string, GitCommit>();
  for (const commit of commits) unique.set(commit.id, commit);
  return [...unique.values()].sort(
    (a, b) => new Date(b.committedAt).getTime() - new Date(a.committedAt).getTime(),
  );
}

function normalizeChangeType(status: string): GitFileChangeType {
  if (status === "added") return "added";
  if (status === "removed" || status === "deleted") return "deleted";
  if (status === "renamed") return "renamed";
  if (status === "copied") return "copied";
  if (status === "modified" || status === "changed") return "modified";
  return "unknown";
}

function trimPatch(patch?: string | null): {
  patch: string | null;
  patchTruncated: boolean;
} {
  if (!patch) return { patch: null, patchTruncated: false };
  return {
    patch: patch.slice(0, MAX_PATCH_LENGTH),
    patchTruncated: patch.length > MAX_PATCH_LENGTH,
  };
}

function countDiffLines(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

async function loadGitHubCommitDetail(
  commit: GitCommit,
  signal?: AbortSignal,
): Promise<GitCommitDetail> {
  const encodedProject = commit.projectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const response = await requestExternalJson<GitHubCommitDetailResponse>(
    `${GITHUB_API}/repos/${encodedProject}/commits/${encodeURIComponent(commit.sha)}`,
    "github",
    signal,
  );
  const files: GitCommitFile[] = (response.files ?? []).map((file) => {
    const patch = trimPatch(file.patch);
    return {
      id: file.sha || file.filename,
      path: file.filename,
      previousPath: file.previous_filename ?? null,
      changeType: normalizeChangeType(file.status),
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: patch.patch,
      patchTruncated: patch.patchTruncated,
      webUrl: file.blob_url ?? null,
    };
  });
  const verification = response.commit?.verification;

  return {
    additions: response.stats?.additions ?? null,
    deletions: response.stats?.deletions ?? null,
    changes: response.stats?.total ?? null,
    files,
    filesTruncated: files.length >= 300,
    verified: verification?.verified ?? null,
    verificationReason: verification?.reason ?? null,
  };
}

async function loadGitLabCommitDetail(
  commit: GitCommit,
  signal?: AbortSignal,
): Promise<GitCommitDetail> {
  const commitPath = `${GITLAB_API}/projects/${encodeURIComponent(commit.projectId)}/repository/commits/${encodeURIComponent(commit.sha)}`;
  const [detail, diffs] = await Promise.all([
    requestExternalJson<GitLabCommitResponse>(`${commitPath}?stats=true`, "gitlab", signal),
    requestExternalJson<GitLabDiffResponse[]>(
      `${commitPath}/diff?per_page=${PAGE_SIZE}&page=1` ,
      "gitlab",
      signal,
    ),
  ]);
  const files: GitCommitFile[] = diffs.map((diff, index) => {
    const counts = countDiffLines(diff.diff ?? "");
    const patch = trimPatch(diff.diff);
    const changeType = diff.new_file
      ? "added"
      : diff.deleted_file
        ? "deleted"
        : diff.renamed_file
          ? "renamed"
          : "modified";
    return {
      id: `${index}:${diff.old_path}:${diff.new_path}`,
      path: diff.new_path,
      previousPath: diff.renamed_file ? diff.old_path : null,
      changeType,
      additions: counts.additions,
      deletions: counts.deletions,
      changes: counts.additions + counts.deletions,
      patch: patch.patch,
      patchTruncated: patch.patchTruncated || Boolean(diff.too_large || diff.collapsed),
      webUrl: `${commit.webUrl}#${encodeURIComponent(diff.new_path)}`,
    };
  });

  return {
    additions: detail.stats?.additions ?? null,
    deletions: detail.stats?.deletions ?? null,
    changes: detail.stats?.total ?? null,
    files,
    filesTruncated: diffs.length >= PAGE_SIZE || diffs.some((diff) => Boolean(diff.too_large)),
    verified: null,
    verificationReason: null,
  };
}

export async function loadGitCommitDetail(
  commit: GitCommit,
  signal?: AbortSignal,
): Promise<GitCommitDetail> {
  const cached = gitCommitDetailCache.get(commit.id);
  if (cached) return cached;

  const detail =
    commit.platform === "github"
      ? await loadGitHubCommitDetail(commit, signal)
      : await loadGitLabCommitDetail(commit, signal);
  gitCommitDetailCache.set(commit.id, detail);
  return detail;
}
