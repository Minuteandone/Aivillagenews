import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiltersPanel } from "./components/FiltersPanel";
import { ClearFilterIcon, FilterIcon, HashIcon } from "./components/Icons";
import { MessageList } from "./components/MessageList";
import { MobileFilterDrawer } from "./components/MobileFilterDrawer";
import { activeTransport, loadDayMessages, loadVillage } from "./lib/api";
import { formatDateLong, pluralizeMessages } from "./lib/format";
import {
  buildAgentOptions,
  buildRoomOptions,
  filterMessages,
} from "./lib/messages";
import type { ChatMessage, VillageData } from "./types";

const DEFAULT_SLUG = "actual-launch-1";

function messageForError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  if (error instanceof Error) return error.message;
  return "Something unexpected interrupted the archive request.";
}

export default function App() {
  const [slugInput, setSlugInput] = useState(DEFAULT_SLUG);
  const [village, setVillage] = useState<VillageData | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("all");
  const [selectedAgentId, setSelectedAgentId] = useState("all");
  const [loadingVillage, setLoadingVillage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [transportLabel, setTransportLabel] = useState("Checking the public archive route…");
  const [dayMessageCounts, setDayMessageCounts] = useState<Map<string, number>>(new Map());

  const villageAbortRef = useRef<AbortController | null>(null);
  const dayAbortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const didInitialLoadRef = useRef(false);

  const roomOptions = useMemo(
    () => buildRoomOptions(messages, village?.rooms ?? []),
    [messages, village?.rooms],
  );

  const agentOptions = useMemo(
    () => buildAgentOptions(messages, village?.agents ?? [], selectedRoomId),
    [messages, selectedRoomId, village?.agents],
  );

  const roomMessageCount = useMemo(
    () =>
      selectedRoomId === "all"
        ? messages.length
        : messages.filter((message) => message.roomId === selectedRoomId).length,
    [messages, selectedRoomId],
  );

  const visibleMessages = useMemo(
    () => filterMessages(messages, selectedRoomId, selectedAgentId),
    [messages, selectedAgentId, selectedRoomId],
  );

  const selectedRoomName = useMemo(() => {
    if (selectedRoomId === "all") return "All rooms";
    return roomOptions.find((room) => room.id === selectedRoomId)?.name ?? "Unknown room";
  }, [roomOptions, selectedRoomId]);

  const selectedAgentName = useMemo(() => {
    if (selectedAgentId === "all") return "";
    return village?.agents.find((agent) => agent.id === selectedAgentId)?.name ?? "Unknown agent";
  }, [selectedAgentId, village?.agents]);

  const hasActiveFilters = selectedRoomId !== "all" || selectedAgentId !== "all";

  const updateTransportLabel = useCallback(() => {
    const route = activeTransport();
    setTransportLabel(
      route === "relay"
        ? "Public read-only relay active for GitHub Pages"
        : route === "direct"
          ? "Connected directly to the AI Village API"
          : "Checking the public archive route…",
    );
  }, []);

  const loadVillageBySlug = useCallback(
    async (slug: string) => {
      villageAbortRef.current?.abort();
      dayAbortRef.current?.abort();
      const controller = new AbortController();
      villageAbortRef.current = controller;

      setLoadingVillage(true);
      setLoadingMessages(true);
      setError("");

      try {
        const loadedVillage = await loadVillage(slug, controller.signal);
        setVillage(loadedVillage);
        setSlugInput(loadedVillage.slug);
        setSelectedDate(loadedVillage.latestDate);
        setMessages(loadedVillage.latestMessages);
        setSelectedRoomId("all");
        setSelectedAgentId("all");
        setDayMessageCounts(
          new Map([[loadedVillage.latestDate, loadedVillage.latestMessages.length]]),
        );
      } catch (caughtError) {
        const nextError = messageForError(caughtError);
        if (nextError) setError(nextError);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingVillage(false);
          setLoadingMessages(false);
          updateTransportLabel();
        }
      }
    },
    [updateTransportLabel],
  );

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    void loadVillageBySlug(DEFAULT_SLUG);

    return () => {
      villageAbortRef.current?.abort();
      dayAbortRef.current?.abort();
    };
  }, [loadVillageBySlug]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = 0;
  }, [selectedAgentId, selectedDate, selectedRoomId]);

  const handleSelectDate = useCallback(
    async (date: string, force = false) => {
      if (!village || (!force && date === selectedDate)) return;

      dayAbortRef.current?.abort();
      const controller = new AbortController();
      dayAbortRef.current = controller;

      setSelectedDate(date);
      setMessages([]);
      setSelectedRoomId("all");
      setSelectedAgentId("all");
      setLoadingMessages(true);
      setError("");

      try {
        const loadedMessages = await loadDayMessages(village, date, controller.signal);
        setMessages(loadedMessages);
        setDayMessageCounts((current) => {
          const next = new Map(current);
          next.set(date, loadedMessages.length);
          return next;
        });
      } catch (caughtError) {
        const nextError = messageForError(caughtError);
        if (nextError) setError(nextError);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingMessages(false);
          updateTransportLabel();
        }
      }
    },
    [selectedDate, updateTransportLabel, village],
  );

  const clearFilters = useCallback(() => {
    setSelectedRoomId("all");
    setSelectedAgentId("all");
  }, []);

  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedAgentId("all");
  }, []);

  const filtersProps = {
    slugInput,
    onSlugInputChange: setSlugInput,
    onLoadVillage: () => void loadVillageBySlug(slugInput),
    loadingVillage,
    dates: village?.dates ?? [],
    selectedDate,
    messageCounts: dayMessageCounts,
    onSelectDate: (date: string) => void handleSelectDate(date),
    rooms: roomOptions,
    selectedRoomId,
    onSelectRoom: handleSelectRoom,
    agents: agentOptions,
    selectedAgentId,
    onSelectAgent: setSelectedAgentId,
    totalMessages: messages.length,
    roomMessageCount,
    transportLabel,
  };

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar" aria-label="Archive controls">
        <FiltersPanel {...filtersProps} />
      </aside>

      <main className="archive-main">
        <header className="mobile-topbar">
          <span className="app-title app-title--mobile">Village Archive</span>
          <button
            type="button"
            className="secondary-button mobile-filter-button"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <FilterIcon />
            Filters
          </button>
        </header>

        <header className="transcript-header">
          <div>
            <h1>{selectedDate ? formatDateLong(selectedDate) : "Choose a village"}</h1>
            <div className="transcript-header__meta">
              <span>{selectedRoomId === "all" ? "All rooms" : `#${selectedRoomName}`}</span>
              <span aria-hidden="true">•</span>
              <span>{pluralizeMessages(visibleMessages.length)}</span>
              {hasActiveFilters && visibleMessages.length !== messages.length && (
                <span className="muted-total">of {pluralizeMessages(messages.length)}</span>
              )}
              {selectedAgentName && <span className="active-agent-label">{selectedAgentName}</span>}
            </div>
          </div>
          <button
            type="button"
            className="secondary-button clear-filter-button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
          >
            <ClearFilterIcon />
            Clear filters
          </button>
        </header>

        <nav className="mobile-room-switcher" aria-label="Rooms">
          <button
            type="button"
            aria-pressed={selectedRoomId === "all"}
              onClick={() => handleSelectRoom("all")}
          >
            All
          </button>
          {roomOptions.map((room) => (
            <button
              type="button"
              aria-pressed={selectedRoomId === room.id}
              onClick={() => handleSelectRoom(room.id)}
              key={room.id}
            >
              <HashIcon />
              {room.name}
            </button>
          ))}
        </nav>

        {error && (
          <div className="status-banner status-banner--error" role="alert">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                if (village && selectedDate) void handleSelectDate(selectedDate, true);
                else void loadVillageBySlug(slugInput);
              }}
            >
              Retry
            </button>
          </div>
        )}

        {loadingMessages && selectedDate && (
          <div className="status-banner" role="status">
            Reading Day {selectedDate} from the public archive… Historical days can take a moment.
          </div>
        )}

        <div className="transcript-scroll" ref={transcriptRef}>
          <MessageList
            messages={visibleMessages}
            rooms={village?.rooms ?? []}
            showRoomLabels={selectedRoomId === "all"}
            loading={loadingMessages}
          />
        </div>
      </main>

      <MobileFilterDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        {...filtersProps}
      />
    </div>
  );
}
