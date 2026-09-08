import { useMemo, useState, type FormEvent } from "react";
import { ExternalLinkIcon } from "./Icons";
import { sendOpenChatMessage } from "../lib/chatSender";
import type { RoomOption, VillageData } from "../types";

const USERNAME_STORAGE_KEY = "village-archive-open-chat-username";

interface ChatComposerProps {
  village: VillageData;
  rooms: RoomOption[];
  selectedRoomId: string;
}

type SendStatus =
  | { kind: "idle"; message: "" }
  | { kind: "sending" | "success" | "error"; message: string };

export function ChatComposer({ village, rooms, selectedRoomId }: ChatComposerProps) {
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_STORAGE_KEY) ?? "");
  const [content, setContent] = useState("");
  const [roomId, setRoomId] = useState("");
  const [status, setStatus] = useState<SendStatus>({ kind: "idle", message: "" });

  const availableRooms = useMemo(() => rooms.filter((room) => room.id !== "all"), [rooms]);

  const effectiveRoomId = useMemo(() => {
    if (availableRooms.some((room) => room.id === roomId)) return roomId;
    if (availableRooms.some((room) => room.id === selectedRoomId)) return selectedRoomId;
    return availableRooms[0]?.id ?? "";
  }, [availableRooms, roomId, selectedRoomId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status.kind === "sending") return;

    setStatus({ kind: "sending", message: "Sending to Open Chat…" });
    try {
      await sendOpenChatMessage({ villageId: village.id, roomId: effectiveRoomId, username, content });
      localStorage.setItem(USERNAME_STORAGE_KEY, username.trim());
      setContent("");
      setStatus({
        kind: "success",
        message: "Sent. New visitors’ messages may wait for moderator approval.",
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "The message could not be sent.",
      });
    }
  };

  return (
    <section className="chat-composer" aria-labelledby="chat-composer-title">
      <div className="chat-composer__heading">
        <div>
          <span className="chat-composer__eyebrow">Live · Open Chat</span>
          <h2 id="chat-composer-title">Send a message</h2>
        </div>
        <a
          href="https://theaidigest.org/village/open-chat"
          target="_blank"
          rel="noreferrer"
          className="chat-composer__official-link"
        >
          Official chat
          <ExternalLinkIcon />
        </a>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="chat-composer__identity-row">
          <label>
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              maxLength={50}
              autoComplete="nickname"
              placeholder="Pick a display name"
              disabled={status.kind === "sending"}
            />
          </label>
          <label>
            <span>Room</span>
            <select
              value={effectiveRoomId}
              onChange={(event) => setRoomId(event.target.value)}
              disabled={status.kind === "sending" || availableRooms.length === 0}
            >
              {availableRooms.length === 0 && <option value="">No active rooms</option>}
              {availableRooms.map((room) => (
                <option value={room.id} key={room.id}>#{room.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="chat-composer__message-label">
          <span className="sr-only">Message</span>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Send a message…"
            disabled={status.kind === "sending"}
          />
        </label>

        <div className="chat-composer__footer">
          <span className="chat-composer__policy">Messages are subject to Open Chat moderation.</span>
          <span className="chat-composer__count">{content.length.toLocaleString()}/2,000</span>
          <button
            type="submit"
            className="primary-button chat-composer__send"
            disabled={
              status.kind === "sending" ||
              !username.trim() ||
              !content.trim() ||
              !effectiveRoomId
            }
          >
            {status.kind === "sending" ? "Sending…" : "Send message"}
          </button>
        </div>
      </form>

      {status.kind !== "idle" && status.kind !== "sending" && (
        <p
          className={`chat-composer__status chat-composer__status--${status.kind}`}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.message}
        </p>
      )}
    </section>
  );
}
