import { Fragment, useMemo, useState } from "react";
import { formatMemoryTimestamp, formatVillageTime } from "../lib/format";
import type {
  ActivityEvent,
  ApiChatRoom,
  ContextChatMessage,
  MemoryPair,
  TimelineItem,
} from "../types";
import { AgentAvatar } from "./AgentAvatar";
import { ChevronIcon, CompareIcon, HistoryIcon, MemoryIcon, PauseIcon } from "./Icons";
import { ConsolidationDiff } from "./ConsolidationDiff";

interface TimelineListProps {
  items: TimelineItem[];
  rooms: ApiChatRoom[];
  showRoomLabels: boolean;
  loading: boolean;
  onOpenMemoryPair: (activity: ActivityEvent, pair: MemoryPair) => void;
}
function splitTrailingPunctuation(value: string): [string, string] {
  const match = value.match(/^(.*?)([.,!?;:]+)?$/);
  return [match?.[1] ?? value, match?.[2] ?? ""];
}

function formatEstimatedDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ""}`;
}

function MessageText({ content }: { content: string }) {
  const pieces = useMemo(() => content.split(/(https?:\/\/[^\s]+)/g), [content]);

  return (
    <p className="message-row__content">
      {pieces.map((piece, index) => {
        if (!piece.startsWith("http://") && !piece.startsWith("https://")) {
          return <Fragment key={`${index}-${piece.slice(0, 12)}`}>{piece}</Fragment>;
        }

        const [url, punctuation] = splitTrailingPunctuation(piece);
        return (
          <Fragment key={`${index}-${url}`}>
            <a href={url} target="_blank" rel="noreferrer noopener">
              {url}
            </a>
            {punctuation}
          </Fragment>
        );
      })}
    </p>
  );
}

function LoadingRows() {
  return (
    <div className="loading-transcript" aria-label="Loading timeline" aria-busy="true">
      {Array.from({ length: 7 }, (_, index) => (
        <div className="skeleton-message" key={index}>
          <span className="skeleton skeleton--avatar" />
          <div>
            <span className="skeleton skeleton--name" />
            <span className="skeleton skeleton--line" />
            <span className="skeleton skeleton--line skeleton--line-short" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ContextMessageRow({
  message,
  roomName,
  showRoomLabel,
}: {
  message: ContextChatMessage;
  roomName: string | null;
  showRoomLabel: boolean;
}) {
  return (
    <li className={`message-row message-row--context message-row--${message.contextKind}`}>
      <AgentAvatar
        id={message.speakerId}
        name={message.speakerName}
        kind={message.speakerKind}
      />
      <article>
        <header className="message-row__header">
          <strong>{message.speakerName}</strong>
          <time dateTime={message.createdAt}>{formatMemoryTimestamp(message.createdAt)}</time>
          {showRoomLabel && roomName && (
            <span className="message-row__room">#{roomName}</span>
          )}
          <span className="message-row__context-badge">{message.badge}</span>
        </header>
        <MessageText content={message.content} />
      </article>
    </li>
  );
}

function ActivityChat({ messages }: { messages: ContextChatMessage[] }) {
  if (messages.length === 0) {
    return <p className="activity-detail__empty">No helper chat messages were recorded.</p>;
  }

  return (
    <ol className="activity-detail__chat">
      {messages.map((message) => (
        <li key={message.id}>
          <header>
            <strong>{message.speakerName}</strong>
            <span>{message.badge}</span>
            <time dateTime={message.createdAt}>{formatMemoryTimestamp(message.createdAt)}</time>
          </header>
          <MessageText content={message.content} />
        </li>
      ))}
    </ol>
  );
}

function StructuredActionDetails({ activity }: { activity: ActivityEvent }) {
  const isHumanUse = activity.actionType === "REQUEST_HUMAN_HELPER";
  const isOutreach = activity.actionType === "OUTREACH_APPROVAL_REQUEST";
  if (!isHumanUse && !isOutreach) return null;

  const decisionLabel = activity.status === "denied" ? "Denial reason" : "Approval reason";

  return (
    <details className="activity-row__details activity-row__details--structured">
      <summary>{isHumanUse ? "View request & chat" : "View request & review"}</summary>
      <div className="activity-detail">
        {isOutreach && (activity.medium || activity.recipient) && (
          <dl className="activity-detail__meta">
            {activity.medium && (
              <div>
                <dt>Medium</dt>
                <dd>{activity.medium}</dd>
              </div>
            )}
            {activity.recipient && (
              <div>
                <dt>Recipient</dt>
                <dd>{activity.recipient}</dd>
              </div>
            )}
          </dl>
        )}

        <section>
          <h4>Request</h4>
          {activity.request ? (
            <MessageText content={activity.request} />
          ) : (
            <p className="activity-detail__empty">No request text was recorded.</p>
          )}
        </section>

        {isOutreach && activity.rationale && (
          <section>
            <h4>Why the agent requested outreach</h4>
            <MessageText content={activity.rationale} />
          </section>
        )}

        {isOutreach && activity.status !== "pending" && (
          <section>
            <h4>{decisionLabel}</h4>
            {activity.reviewReason ? (
              <MessageText content={activity.reviewReason} />
            ) : (
              <p className="activity-detail__empty">No reviewer reason was provided.</p>
            )}
          </section>
        )}

        {isHumanUse && (
          <>
            {(activity.estimatedDuration !== null || activity.humanConstraints) && (
              <dl className="activity-detail__meta">
                {activity.estimatedDuration !== null && (
                  <div>
                    <dt>Estimated time</dt>
                    <dd>{formatEstimatedDuration(activity.estimatedDuration)}</dd>
                  </div>
                )}
                {activity.humanConstraints && (
                  <div>
                    <dt>Helper requirements</dt>
                    <dd>{activity.humanConstraints}</dd>
                  </div>
                )}
              </dl>
            )}
            {activity.statusDetail && (
              <section>
                <h4>Status note</h4>
                <p>{activity.statusDetail}</p>
              </section>
            )}
            <section>
              <h4>Human helper chat</h4>
              <ActivityChat messages={activity.chatMessages} />
            </section>
          </>
        )}
      </div>
    </details>
  );
}

interface ActivityRowProps {
  activity: ActivityEvent;
  roomName: string | null;
  showRoomLabel: boolean;
  onOpenMemoryPair: (activity: ActivityEvent, pair: MemoryPair) => void;
}

function ActivityRow({
  activity,
  roomName,
  showRoomLabel,
  onOpenMemoryPair,
}: ActivityRowProps) {
  const [expanded, setExpanded] = useState(false);
  const isConsolidation = activity.kind === "consolidation";
  const isStructuredAction =
    activity.actionType === "REQUEST_HUMAN_HELPER" ||
    activity.actionType === "OUTREACH_APPROVAL_REQUEST";
  const icon =
    activity.kind === "pause" ? (
      <span className="activity-row__icon activity-row__icon--pause">
        <PauseIcon />
      </span>
    ) : isConsolidation ? (
      <span className="activity-row__icon activity-row__icon--memory">
        <MemoryIcon />
      </span>
    ) : (
      <span className="activity-row__icon activity-row__icon--other">
        <HistoryIcon />
      </span>
    );

  return (
    <li className={`activity-row activity-row--${activity.kind}`}>
      <div className="activity-row__summary">
        {icon}
        <div className="activity-row__copy">
          <header>
            <strong>{activity.agentName}</strong>
            <time dateTime={activity.createdAt}>{formatVillageTime(activity.createdAt)}</time>
            {isConsolidation && <span className="activity-row__badge">Consolidated memory</span>}
            {activity.status && (
              <span className={`activity-row__status activity-row__status--${activity.status}`}>
                {activity.status}
              </span>
            )}
            {showRoomLabel && roomName && <span className="message-row__room">#{roomName}</span>}
          </header>
          <p>{isConsolidation ? (activity.detail ?? activity.summary) : activity.summary}</p>
          {isStructuredAction && activity.detail && (
            <p className="activity-row__subject">{activity.detail}</p>
          )}
          {!isConsolidation && !isStructuredAction && activity.detail && (
            <details className="activity-row__details">
              <summary>View details</summary>
              <p>{activity.detail}</p>
            </details>
          )}
          {isStructuredAction && <StructuredActionDetails activity={activity} />}
        </div>
        {isConsolidation && (
          <button
            type="button"
            className="activity-row__compare"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <CompareIcon />
            {expanded ? "Close comparison" : "Compare memory"}
            <ChevronIcon className={expanded ? "is-open" : ""} />
          </button>
        )}
      </div>
      {isConsolidation && expanded && (
        <ConsolidationDiff
          activity={activity}
          onOpenVersion={(pair) => onOpenMemoryPair(activity, pair)}
        />
      )}
    </li>
  );
}

export function TimelineList({
  items,
  rooms,
  showRoomLabels,
  loading,
  onOpenMemoryPair,
}: TimelineListProps) {
  const roomNames = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  );

  if (loading) return <LoadingRows />;

  if (items.length === 0) {
    return (
      <div className="empty-transcript">
        <div className="empty-transcript__mark" aria-hidden="true" />
        <h2>No timeline items match</h2>
        <p>Try another room, agent, day, or context toggle.</p>
      </div>
    );
  }

  return (
    <ol className="message-list" aria-label="Chronological village timeline">
      {items.map((item) => {
        if (item.kind === "activity") {
          return (
            <ActivityRow
              activity={item.activity}
              roomName={item.activity.roomId ? (roomNames.get(item.activity.roomId) ?? null) : null}
              showRoomLabel={showRoomLabels}
              onOpenMemoryPair={onOpenMemoryPair}
              key={`activity-${item.activity.id}`}
            />
          );
        }

        if (item.kind === "context-message") {
          return (
            <ContextMessageRow
              message={item.message}
              roomName={item.message.roomId ? (roomNames.get(item.message.roomId) ?? null) : null}
              showRoomLabel={showRoomLabels}
              key={`context-${item.message.id}`}
            />
          );
        }

        const { message } = item;
        return (
          <li className="message-row" key={`message-${message.id}`}>
            <AgentAvatar
              id={message.speakerId}
              name={message.speakerName}
              kind={message.speakerKind}
            />
            <article>
              <header className="message-row__header">
                <strong>{message.speakerName}</strong>
                <time dateTime={message.createdAt}>{formatVillageTime(message.createdAt)}</time>
                {showRoomLabels && (
                  <span className="message-row__room">
                    #{roomNames.get(message.roomId) ?? "unknown-room"}
                  </span>
                )}
                {message.speakerKind === "human" && (
                  <span className="message-row__human">human</span>
                )}
              </header>
              <MessageText content={message.content} />
            </article>
          </li>
        );
      })}
    </ol>
  );
}
