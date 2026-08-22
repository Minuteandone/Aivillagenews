import { useEffect, useMemo, useState } from "react";
import { agentPageSlug, loadAgentStory } from "../lib/api";
import { formatDateLong, formatProfileTimestamp } from "../lib/format";
import type {
  AgentProfilesIndex,
  AgentStory,
  ApiAgent,
  ApiChatRoom,
  ChatMessage,
} from "../types";
import { AgentAvatar } from "./AgentAvatar";
import { ExternalLinkIcon, MemoryIcon } from "./Icons";
import { MemoryDocument } from "./MemoryDocument";
import { ActivityRow, MessageText } from "./MessageList";

interface AgentProfilePageProps {
  agent: ApiAgent;
  rooms: ApiChatRoom[];
  profileIndex: AgentProfilesIndex | null;
  loadingProfileIndex: boolean;
  profileIndexError: string;
  onOpenMemory: () => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error ? error.message : "The Village story could not be loaded.";
}

function AgentMessageCard({
  label,
  message,
  roomName,
}: {
  label: string;
  message: ChatMessage | null;
  roomName: string | null;
}) {
  if (!message) {
    return (
      <article className="agent-message-card agent-message-card--empty">
        <span className="agent-profile__eyebrow">{label}</span>
        <p>No recorded agent message was found.</p>
      </article>
    );
  }

  const sourceUrl = `https://theaidigest.org/village?time=${new Date(message.createdAt).getTime()}`;

  return (
    <article className="agent-message-card">
      <header>
        <div>
          <span className="agent-profile__eyebrow">{label}</span>
          <time dateTime={message.createdAt}>{formatProfileTimestamp(message.createdAt)}</time>
        </div>
        <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
          Original moment
          <ExternalLinkIcon />
        </a>
      </header>
      {roomName && <span className="agent-message-card__room">#{roomName}</span>}
      <MessageText content={message.content} />
    </article>
  );
}

function StoryStatus({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <div className={`agent-story__status${error ? " agent-story__status--error" : ""}`}>
      {message}
    </div>
  );
}

export function AgentProfilePage({
  agent,
  rooms,
  profileIndex,
  loadingProfileIndex,
  profileIndexError,
  onOpenMemory,
}: AgentProfilePageProps) {
  const [storyState, setStoryState] = useState<{
    agentName: string;
    story: AgentStory | null;
    error: string;
  }>({ agentName: "", story: null, error: "" });
  const profile = profileIndex?.profiles[agent.id] ?? null;
  const roomNames = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  );
  const sourceUrl = `https://theaidigest.org/village/agent/${agentPageSlug(agent.name)}`;
  const story = storyState.agentName === agent.name ? storyState.story : null;
  const storyError = storyState.agentName === agent.name ? storyState.error : "";
  const loadingStory = storyState.agentName !== agent.name;

  useEffect(() => {
    const controller = new AbortController();

    void loadAgentStory(agent.name, controller.signal)
      .then((loadedStory) => {
        if (!controller.signal.aborted) {
          setStoryState({ agentName: agent.name, story: loadedStory, error: "" });
        }
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (message && !controller.signal.aborted) {
          setStoryState({ agentName: agent.name, story: null, error: message });
        }
      });

    return () => controller.abort();
  }, [agent.name]);

  return (
    <article className="agent-profile">
      <header className="agent-profile__hero">
        <AgentAvatar id={agent.id} name={agent.name} />
        <div className="agent-profile__identity">
          <span className="agent-profile__eyebrow">Agent page</span>
          <h2>{agent.emoji ? `${agent.emoji} ` : ""}{agent.name}</h2>
          <div className="agent-profile__meta">
            {agent.modelString && <span>{agent.modelString}</span>}
            {agent.createdAt && <span>Joined {formatProfileTimestamp(agent.createdAt)}</span>}
            <span className={`agent-profile__status agent-profile__status--${agent.isParticipating ? "active" : "historical"}`}>
              {agent.isParticipating ? "participating" : "historical"}
            </span>
          </div>
          {agent.goal && <p className="agent-profile__goal">{agent.goal}</p>}
        </div>
        <div className="agent-profile__actions">
          <button type="button" className="primary-button" onClick={onOpenMemory}>
            <MemoryIcon />
            Browse memory
          </button>
          <a className="secondary-button" href={sourceUrl} target="_blank" rel="noreferrer noopener">
            Village page
            <ExternalLinkIcon />
          </a>
        </div>
      </header>

      <section className="agent-profile__section agent-story" aria-labelledby="agent-story-heading">
        <div className="agent-profile__section-heading">
          <div>
            <span className="agent-profile__eyebrow">Official profile context</span>
            <h3 id="agent-story-heading">From the Village</h3>
          </div>
          <a href={story?.sourceUrl ?? sourceUrl} target="_blank" rel="noreferrer noopener">
            Source
            <ExternalLinkIcon />
          </a>
        </div>
        {loadingStory && <StoryStatus message="Loading the Village summary…" />}
        {!loadingStory && storyError && <StoryStatus message={storyError} error />}
        {!loadingStory && story && (
          <>
            <p className="agent-story__attribution">{story.attribution}</p>
            <MemoryDocument content={story.markdown} />
          </>
        )}
      </section>

      <section className="agent-profile__section" aria-labelledby="agent-bookends-heading">
        <div className="agent-profile__section-heading">
          <div>
            <span className="agent-profile__eyebrow">Transcript bookends</span>
            <h3 id="agent-bookends-heading">First and last messages</h3>
          </div>
          {profileIndex && (
            <span className="agent-profile__indexed-date">
              Indexed through {formatDateLong(profileIndex.indexedThroughDate)}
            </span>
          )}
        </div>
        {loadingProfileIndex && <StoryStatus message="Loading lifetime message index…" />}
        {!loadingProfileIndex && profileIndexError && (
          <StoryStatus message={profileIndexError} error />
        )}
        {!loadingProfileIndex && !profileIndexError && profile && (
          <div className="agent-message-grid">
            <AgentMessageCard
              label="First message"
              message={profile.firstMessage}
              roomName={
                profile.firstMessage
                  ? (roomNames.get(profile.firstMessage.roomId) ?? "unknown-room")
                  : null
              }
            />
            <AgentMessageCard
              label="Last message"
              message={profile.lastMessage}
              roomName={
                profile.lastMessage
                  ? (roomNames.get(profile.lastMessage.roomId) ?? "unknown-room")
                  : null
              }
            />
          </div>
        )}
      </section>

      <section className="agent-profile__section" aria-labelledby="agent-helper-heading">
        <div className="agent-profile__section-heading">
          <div>
            <span className="agent-profile__eyebrow">Human collaboration</span>
            <h3 id="agent-helper-heading">Human helper requests</h3>
          </div>
          {profile && (
            <span className="agent-profile__request-count">
              {profile.humanHelperRequests.length.toLocaleString()} total
            </span>
          )}
        </div>
        {loadingProfileIndex && <StoryStatus message="Loading helper request history…" />}
        {!loadingProfileIndex && profileIndexError && (
          <StoryStatus message={profileIndexError} error />
        )}
        {!loadingProfileIndex && !profileIndexError && profile?.humanHelperRequests.length === 0 && (
          <div className="agent-profile__empty">
            No human helper requests were recorded for this agent.
          </div>
        )}
        {!loadingProfileIndex && !profileIndexError && profile && profile.humanHelperRequests.length > 0 && (
          <ol className="agent-profile__requests">
            {profile.humanHelperRequests.map((request) => (
              <ActivityRow
                activity={request}
                roomName={request.roomId ? (roomNames.get(request.roomId) ?? "unknown-room") : null}
                showRoomLabel
                onOpenMemoryPair={() => undefined}
                key={request.id}
              />
            ))}
          </ol>
        )}
      </section>
    </article>
  );
}
