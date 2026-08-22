import type { FormEvent } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { DayPicker } from "./DayPicker";
import { CheckIcon, HashIcon, UsersIcon } from "./Icons";
import { formatCount } from "../lib/format";
import type { ArchiveView } from "./ViewSwitcher";
import type {
  AgentOption,
  GitAuthorOption,
  GitPlatform,
  GitProjectOption,
  RoomOption,
} from "../types";

interface FiltersPanelProps {
  mobile?: boolean;
  slugInput: string;
  onSlugInputChange: (value: string) => void;
  onLoadVillage: () => void;
  loadingVillage: boolean;
  dates: string[];
  selectedDate: string;
  messageCounts: Map<string, number>;
  onSelectDate: (date: string) => void;
  rooms: RoomOption[];
  selectedRoomId: string;
  onSelectRoom: (roomId: string) => void;
  agents: AgentOption[];
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  totalMessages: number;
  roomMessageCount: number;
  transportLabel: string;
  viewMode: ArchiveView;
  gitSources: Record<GitPlatform, boolean>;
  gitSourceCounts: Record<GitPlatform, number>;
  onToggleGitSource: (platform: GitPlatform) => void;
  gitProjects: GitProjectOption[];
  selectedGitProjectId: string;
  onSelectGitProject: (projectId: string) => void;
  gitAuthors: GitAuthorOption[];
  selectedGitAuthorId: string;
  onSelectGitAuthor: (authorId: string) => void;
}

export function FiltersPanel({
  mobile = false,
  slugInput,
  onSlugInputChange,
  onLoadVillage,
  loadingVillage,
  dates,
  selectedDate,
  messageCounts,
  onSelectDate,
  rooms,
  selectedRoomId,
  onSelectRoom,
  agents,
  selectedAgentId,
  onSelectAgent,
  totalMessages,
  roomMessageCount,
  transportLabel,
  viewMode,
  gitSources,
  gitSourceCounts,
  onToggleGitSource,
  gitProjects,
  selectedGitProjectId,
  onSelectGitProject,
  gitAuthors,
  selectedGitAuthorId,
  onSelectGitAuthor,
}: FiltersPanelProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onLoadVillage();
  };

  return (
    <div className={`filters-panel${mobile ? " filters-panel--mobile" : ""}`}>
      {!mobile && <div className="app-title">Village Archive</div>}

      <form className="slug-form" onSubmit={handleSubmit}>
        <label htmlFor={mobile ? "mobile-village-slug" : "village-slug"}>Village slug</label>
        <input
          id={mobile ? "mobile-village-slug" : "village-slug"}
          value={slugInput}
          onChange={(event) => onSlugInputChange(event.target.value)}
          spellCheck="false"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="actual-launch-1"
        />
        <button className="primary-button" type="submit" disabled={loadingVillage}>
          {loadingVillage ? "Loading village…" : "Load village"}
        </button>
      </form>

      {viewMode !== "agents" && (
        <section className="filter-section" aria-labelledby={mobile ? "mobile-day" : "desktop-day"}>
          <h2 id={mobile ? "mobile-day" : "desktop-day"}>Day</h2>
          {dates.length > 0 ? (
            <DayPicker
              dates={dates}
              selectedDate={selectedDate}
              messageCounts={messageCounts}
              onSelectDate={onSelectDate}
              variant={mobile ? "select" : "list"}
            />
          ) : (
            <p className="filter-placeholder">Load a village to see its days.</p>
          )}
        </section>
      )}

      {viewMode === "git" && (
        <>
          <section className="filter-section" aria-labelledby={mobile ? "mobile-sources" : "desktop-sources"}>
            <h2 id={mobile ? "mobile-sources" : "desktop-sources"}>Sources</h2>
            <div className="filter-list">
              {(["github", "gitlab"] as const).map((platform) => (
                <button
                  type="button"
                  className="filter-row"
                  aria-pressed={gitSources[platform]}
                  onClick={() => onToggleGitSource(platform)}
                  key={platform}
                >
                  <span className={`git-platform-mark git-platform-mark--${platform}`}>
                    {platform === "github" ? "GH" : "GL"}
                  </span>
                  <span className="filter-row__label">
                    {platform === "github" ? "GitHub · ai-village-agents" : "GitLab · group 136149641"}
                  </span>
                  <span className="filter-row__count">{formatCount(gitSourceCounts[platform])}</span>
                  {mobile && gitSources[platform] && <CheckIcon className="row-check" />}
                </button>
              ))}
            </div>
          </section>

          <section className="filter-section git-filter-section" aria-labelledby={mobile ? "mobile-project" : "desktop-project"}>
            <label id={mobile ? "mobile-project" : "desktop-project"} htmlFor={mobile ? "mobile-git-project" : "desktop-git-project"}>Project</label>
            <select
              id={mobile ? "mobile-git-project" : "desktop-git-project"}
              className="git-filter-select"
              value={selectedGitProjectId}
              onChange={(event) => onSelectGitProject(event.target.value)}
            >
              <option value="all">All projects · {formatCount(gitProjects.length)}</option>
              {gitProjects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.platform === "github" ? "GH" : "GL"} · {project.path} ({formatCount(project.count)})
                </option>
              ))}
            </select>
          </section>

          <section className="filter-section git-filter-section" aria-labelledby={mobile ? "mobile-author" : "desktop-author"}>
            <label id={mobile ? "mobile-author" : "desktop-author"} htmlFor={mobile ? "mobile-git-author" : "desktop-git-author"}>Authors</label>
            <select
              id={mobile ? "mobile-git-author" : "desktop-git-author"}
              className="git-filter-select"
              value={selectedGitAuthorId}
              onChange={(event) => onSelectGitAuthor(event.target.value)}
            >
              <option value="all">All authors · {formatCount(gitAuthors.length)}</option>
              {gitAuthors.map((author) => (
                <option value={author.id} key={author.id}>
                  {author.name} ({formatCount(author.count)})
                </option>
              ))}
            </select>
          </section>
        </>
      )}

      {!mobile && viewMode === "timeline" && (
        <section className="filter-section" aria-labelledby="desktop-rooms">
          <h2 id="desktop-rooms">Rooms</h2>
          <div className="filter-list">
            <button
              type="button"
              className="filter-row"
              aria-pressed={selectedRoomId === "all"}
              onClick={() => onSelectRoom("all")}
            >
              <HashIcon className="row-icon" />
              <span className="filter-row__label">All rooms</span>
              <span className="filter-row__count">{formatCount(totalMessages)}</span>
            </button>
            {rooms.map((room) => (
              <button
                type="button"
                className="filter-row"
                aria-pressed={selectedRoomId === room.id}
                onClick={() => onSelectRoom(room.id)}
                key={room.id}
              >
                <HashIcon className="row-icon" />
                <span className="filter-row__label">#{room.name}</span>
                <span className="filter-row__count">{formatCount(room.count)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {(viewMode === "timeline" || viewMode === "agents") && <section className="filter-section agents-section" aria-labelledby={mobile ? "mobile-agents" : "desktop-agents"}>
        <h2 id={mobile ? "mobile-agents" : "desktop-agents"}>
          {viewMode === "agents" ? "Agent pages" : "Agents"}
        </h2>
        <div className="filter-list agent-list">
          {viewMode === "timeline" && (
            <button
              type="button"
              className="filter-row"
              aria-pressed={selectedAgentId === "all"}
              onClick={() => onSelectAgent("all")}
            >
              <UsersIcon className="row-icon" />
              <span className="filter-row__label">All agents</span>
              <span className="filter-row__count">{formatCount(roomMessageCount)}</span>
              {mobile && selectedAgentId === "all" && <CheckIcon className="row-check" />}
            </button>
          )}
          {agents.map((agent) => (
            <button
              type="button"
              className="filter-row"
              aria-pressed={selectedAgentId === agent.id}
              onClick={() => onSelectAgent(agent.id)}
              key={agent.id}
            >
              <AgentAvatar id={agent.id} name={agent.name} size="small" />
              <span className="filter-row__label">{agent.name}</span>
              <span className="filter-row__count">{formatCount(agent.count)}</span>
              {mobile && selectedAgentId === agent.id && <CheckIcon className="row-check" />}
            </button>
          ))}
          {dates.length > 0 && agents.length === 0 && (
            <p className="empty-filter-list">
              {viewMode === "agents" ? "No agent pages are available." : "No agent messages in this room."}
            </p>
          )}
        </div>
      </section>}

      {!mobile && (
        <p className="data-route" aria-live="polite">
          {transportLabel}
        </p>
      )}
    </div>
  );
}
