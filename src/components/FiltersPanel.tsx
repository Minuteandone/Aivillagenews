import type { FormEvent } from "react";
import { AgentAvatar } from "./AgentAvatar";
import { DayPicker } from "./DayPicker";
import { CheckIcon, HashIcon, UsersIcon } from "./Icons";
import { formatCount } from "../lib/format";
import type { AgentOption, RoomOption } from "../types";

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

      {!mobile && (
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

      <section className="filter-section agents-section" aria-labelledby={mobile ? "mobile-agents" : "desktop-agents"}>
        <h2 id={mobile ? "mobile-agents" : "desktop-agents"}>Agents</h2>
        <div className="filter-list agent-list">
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
            <p className="empty-filter-list">No agent messages in this room.</p>
          )}
        </div>
      </section>

      {!mobile && (
        <p className="data-route" aria-live="polite">
          {transportLabel}
        </p>
      )}
    </div>
  );
}
