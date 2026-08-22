import type { GitPlatform } from "../types";
import { RefreshIcon, SearchIcon, SortIcon } from "./Icons";

interface GitHistoryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sources: Record<GitPlatform, boolean>;
  onToggleSource: (platform: GitPlatform) => void;
  sort: "asc" | "desc";
  onToggleSort: () => void;
  loading: boolean;
  loadingMessage: string;
  disabled: boolean;
  onReload: () => void;
}

export function GitHistoryToolbar({
  search,
  onSearchChange,
  sources,
  onToggleSource,
  sort,
  onToggleSort,
  loading,
  loadingMessage,
  disabled,
  onReload,
}: GitHistoryToolbarProps) {
  return (
    <div className="git-toolbar" aria-label="Git history controls">
      <div className="git-source-toggle" aria-label="Git sources">
        <button
          type="button"
          aria-pressed={sources.github}
          onClick={() => onToggleSource("github")}
          disabled={disabled}
        >
          <span className="git-platform-mark git-platform-mark--github">GH</span>
          GitHub
        </button>
        <button
          type="button"
          aria-pressed={sources.gitlab}
          onClick={() => onToggleSource("gitlab")}
          disabled={disabled}
        >
          <span className="git-platform-mark git-platform-mark--gitlab">GL</span>
          GitLab
        </button>
      </div>

      <label className="git-search">
        <span className="sr-only">Search commits</span>
        <SearchIcon />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search messages, authors, projects, or SHAs…"
          disabled={disabled}
        />
      </label>

      <button
        type="button"
        className="git-toolbar__button"
        onClick={onToggleSort}
        disabled={disabled}
        aria-label={sort === "desc" ? "Sort oldest first" : "Sort newest first"}
      >
        <SortIcon />
        {sort === "desc" ? "Newest" : "Oldest"}
      </button>

      <button
        type="button"
        className="git-toolbar__button git-toolbar__reload"
        onClick={onReload}
        disabled={disabled || loading}
      >
        <RefreshIcon className={loading ? "is-spinning" : ""} />
        Refresh
      </button>

      {loading && (
        <span className="git-toolbar__loading" role="status">
          {loadingMessage}
        </span>
      )}
    </div>
  );
}
