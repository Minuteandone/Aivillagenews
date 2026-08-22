import { useEffect, useRef, useState } from "react";
import { formatMemoryTimestamp } from "../lib/format";
import { loadGitCommitDetail } from "../lib/gitHistory";
import type { GitCommit, GitCommitDetail, GitHistoryResult } from "../types";
import {
  ChevronIcon,
  CodeFileIcon,
  ExternalLinkIcon,
  GitBranchIcon,
} from "./Icons";

interface GitHistoryListProps {
  commits: GitCommit[];
  result: GitHistoryResult | null;
  loading: boolean;
}

function remainingCommitMessage(commit: GitCommit): string {
  const firstBreak = commit.message.search(/\r?\n/);
  return firstBreak < 0 ? "" : commit.message.slice(firstBreak).trim();
}

function platformLabel(platform: GitCommit["platform"]): string {
  return platform === "github" ? "GitHub" : "GitLab";
}

function changeLabel(changeType: string): string {
  return changeType === "unknown" ? "changed" : changeType;
}

function GitLoadingRows() {
  return (
    <div className="git-loading" aria-label="Loading Git history" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="git-skeleton-row" key={index}>
          <span className="skeleton git-skeleton-row__mark" />
          <div>
            <span className="skeleton git-skeleton-row__meta" />
            <span className="skeleton git-skeleton-row__title" />
            <span className="skeleton git-skeleton-row__byline" />
          </div>
        </div>
      ))}
    </div>
  );
}

function FileChange({ file }: { file: GitCommitDetail["files"][number] }) {
  return (
    <li className="git-file">
      <div className="git-file__header">
        <CodeFileIcon />
        <div className="git-file__path">
          <code>{file.path}</code>
          {file.previousPath && <span>from {file.previousPath}</span>}
        </div>
        <span className={`git-file__status git-file__status--${file.changeType}`}>
          {changeLabel(file.changeType)}
        </span>
        {file.additions !== null && (
          <span className="git-change-counts" aria-label={`${file.additions} additions and ${file.deletions ?? 0} deletions`}>
            <b>+{file.additions}</b>
            <i>−{file.deletions ?? 0}</i>
          </span>
        )}
        {file.webUrl && (
          <a
            className="git-file__link"
            href={file.webUrl}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Open ${file.path}`}
          >
            <ExternalLinkIcon />
          </a>
        )}
      </div>
      {file.patch && (
        <details className="git-patch">
          <summary>View patch</summary>
          <pre>{file.patch}</pre>
          {file.patchTruncated && <p>Patch preview truncated.</p>}
        </details>
      )}
    </li>
  );
}

function CommitDetails({ commit }: { commit: GitCommit }) {
  const [detail, setDetail] = useState<GitCommitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
    },
    [],
  );

  const load = () => {
    if (detail || loading) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setError("");
    void loadGitCommitDetail(commit, controller.signal)
      .then((nextDetail) => {
        if (!controller.signal.aborted) setDetail(nextDetail);
      })
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "The commit details could not be loaded.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  };

  const body = remainingCommitMessage(commit);

  return (
    <details
      className="git-commit__details"
      onToggle={(event) => {
        if (event.currentTarget.open) load();
      }}
    >
      <summary>
        <span>View files &amp; details</span>
        <ChevronIcon />
      </summary>
      <div className="git-commit__detail-body">
        {body && (
          <section className="git-commit__message">
            <h3>Commit message</h3>
            <p>{body}</p>
          </section>
        )}

        <dl className="git-commit__metadata">
          <div>
            <dt>Full SHA</dt>
            <dd><code>{commit.sha}</code></dd>
          </div>
          {commit.authorEmail && (
            <div>
              <dt>Author email</dt>
              <dd>{commit.authorEmail}</dd>
            </div>
          )}
          {commit.parentShas.length > 0 && (
            <div>
              <dt>{commit.parentShas.length === 1 ? "Parent" : "Parents"}</dt>
              <dd>{commit.parentShas.map((sha) => <code key={sha}>{sha.slice(0, 8)}</code>)}</dd>
            </div>
          )}
        </dl>

        {loading && <p className="git-detail-status">Loading changed files…</p>}
        {error && (
          <div className="git-detail-status git-detail-status--error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={load}>Retry</button>
          </div>
        )}

        {detail && (
          <>
            <div className="git-detail-summary">
              <span>{detail.files.length} {detail.files.length === 1 ? "file" : "files"}</span>
              {detail.additions !== null && <b>+{detail.additions}</b>}
              {detail.deletions !== null && <i>−{detail.deletions}</i>}
              {detail.verified !== null && (
                <span className={detail.verified ? "is-verified" : "is-unverified"}>
                  {detail.verified ? "Verified signature" : "Unverified signature"}
                </span>
              )}
            </div>
            {detail.files.length > 0 ? (
              <ol className="git-file-list">
                {detail.files.map((file) => <FileChange file={file} key={file.id} />)}
              </ol>
            ) : (
              <p className="git-detail-status">No changed-file preview was returned.</p>
            )}
            {detail.filesTruncated && (
              <p className="git-detail-status">The provider truncated this unusually large diff.</p>
            )}
          </>
        )}
      </div>
    </details>
  );
}

function GitCommitRow({ commit }: { commit: GitCommit }) {
  return (
    <li className={`git-commit git-commit--${commit.platform}`}>
      <div className="git-commit__rail" aria-hidden="true">
        <span className={`git-platform-mark git-platform-mark--${commit.platform}`}>
          {commit.platform === "github" ? "GH" : "GL"}
        </span>
        <span className="git-commit__line" />
      </div>
      <article>
        <header className="git-commit__header">
          <a href={commit.webUrl} target="_blank" rel="noreferrer noopener">
            {commit.projectPath}
          </a>
          <span className="git-commit__platform">{platformLabel(commit.platform)}</span>
          <time dateTime={commit.committedAt}>{formatMemoryTimestamp(commit.committedAt)}</time>
        </header>
        <h2>{commit.title}</h2>
        <div className="git-commit__byline">
          <span>by <strong>{commit.authorName}</strong></span>
          {commit.authorUsername && <span>@{commit.authorUsername}</span>}
          <code>{commit.shortSha}</code>
          {commit.parentShas.length > 1 && <span className="git-commit__merge">merge</span>}
          <a href={commit.webUrl} target="_blank" rel="noreferrer noopener">
            Open commit <ExternalLinkIcon />
          </a>
        </div>
        <CommitDetails commit={commit} />
      </article>
    </li>
  );
}

export function GitHistoryList({ commits, result, loading }: GitHistoryListProps) {
  if (loading && !result) return <GitLoadingRows />;

  return (
    <div className="git-history">
      {result && (
        <div className="git-source-statuses" aria-label="Git data source status">
          {result.sources.map((source) => (
            <span
              className={`git-source-status git-source-status--${source.status}`}
              title={source.detail}
              key={source.platform}
            >
              <i aria-hidden="true" />
              {platformLabel(source.platform)}: {source.count.toLocaleString()}
            </span>
          ))}
          <span className="git-source-status__note">
            GitHub searches default branches; GitLab scans every ref in active projects.
          </span>
        </div>
      )}

      {result && result.warnings.length > 0 && (
        <div className="git-warning" role="status">
          <GitBranchIcon />
          <div>
            {result.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        </div>
      )}

      {commits.length === 0 ? (
        <div className="empty-transcript empty-transcript--git">
          <GitBranchIcon />
          <h2>No commits match</h2>
          <p>Try another day, source, project, author, or search.</p>
        </div>
      ) : (
        <ol className="git-commit-list" aria-label="Git commits">
          {commits.map((commit) => <GitCommitRow commit={commit} key={commit.id} />)}
        </ol>
      )}
    </div>
  );
}
