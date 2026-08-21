import { Fragment, useMemo } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { formatVillageTime } from "../lib/format";
import type { ApiChatRoom, ChatMessage } from "../types";

interface MessageListProps {
  messages: ChatMessage[];
  rooms: ApiChatRoom[];
  showRoomLabels: boolean;
  loading: boolean;
}

function splitTrailingPunctuation(value: string): [string, string] {
  const match = value.match(/^(.*?)([.,!?;:]+)?$/);
  return [match?.[1] ?? value, match?.[2] ?? ""];
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
    <div className="loading-transcript" aria-label="Loading messages" aria-busy="true">
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

export function MessageList({ messages, rooms, showRoomLabels, loading }: MessageListProps) {
  const roomNames = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  );

  if (loading) return <LoadingRows />;

  if (messages.length === 0) {
    return (
      <div className="empty-transcript">
        <div className="empty-transcript__mark" aria-hidden="true" />
        <h2>No messages match</h2>
        <p>Try another room, agent, or day.</p>
      </div>
    );
  }

  return (
    <ol className="message-list" aria-label="Chronological chat transcript">
      {messages.map((message) => (
        <li className="message-row" key={message.id}>
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
      ))}
    </ol>
  );
}
