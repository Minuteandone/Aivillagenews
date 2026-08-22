import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ContextToolbar,
  type ContextVisibility,
} from "./components/ContextToolbar";
import { FiltersPanel } from "./components/FiltersPanel";
import { ClearFilterIcon, FilterIcon, HashIcon } from "./components/Icons";
import {
  MemoryInspector,
  type MemoryLaunch,
} from "./components/MemoryInspector";
import { TimelineList } from "./components/MessageList";
import { MobileFilterDrawer } from "./components/MobileFilterDrawer";
import { buildTimelineItems, mapEventsToActivities } from "./lib/activities";
import {
  activeTransport,
  getCachedDayEvents,
  loadDayEvents,
  loadDayMessages,
  loadHumanUseSessions,
  loadVillage,
} from "./lib/api";
import { formatDateLong, pluralizeItems, pluralizeMessages } from "./lib/format";
import {
  buildAgentOptions,
  buildRoomOptions,
  filterMessages,
} from "./lib/messages";
import type {
  ActivityEvent,
  ApiEvent,
  ChatMessage,
  HumanUseSession,
  MemoryPair,
  VillageData,
} from "./types";

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
  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [humanUseSessions, setHumanUseSessions] = useState<HumanUseSession[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("all");
  const [selectedAgentId, setSelectedAgentId] = useState("all");
  const [loadingVillage, setLoadingVillage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [error, setError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [contextVisibility, setContextVisibility] = useState<ContextVisibility>({
    messages: true,
    pauses: false,
    consolidations: false,
    otherActions: false,
    humanHelperChat: false,
    outreachReasons: false,
  });
  const [memoryLaunch, setMemoryLaunch] = useState<MemoryLaunch | null>(null);
  const [transportLabel, setTransportLabel] = useState("Checking the public archive route…");
  const [dayMessageCounts, setDayMessageCounts] = useState<Map<string, number>>(new Map());

  const villageAbortRef = useRef<AbortController | null>(null);
  const dayAbortRef = useRef<AbortController | null>(null);
  const activityAbortRef = useRef<AbortController | null>(null);
  const activityRequestKeyRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const didInitialLoadRef = useRef(false);
  const memoryLaunchCounterRef = useRef(0);
  const actionsVisibleRef = useRef(false);

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

  const activities = useMemo(
    () =>
      mapEventsToActivities(
        events,
        village?.agents ?? [],
        village?.rooms ?? [],
        humanUseSessions,
      ),
    [events, humanUseSessions, village?.agents, village?.rooms],
  );

  const timelineItems = useMemo(
    () =>
      buildTimelineItems(
        messages,
        activities,
        contextVisibility,
        selectedRoomId,
        selectedAgentId,
      ),
    [activities, contextVisibility, messages, selectedAgentId, selectedRoomId],
  );

  const anyActionsVisible =
    contextVisibility.pauses ||
    contextVisibility.consolidations ||
    contextVisibility.otherActions ||
    contextVisibility.humanHelperChat ||
    contextVisibility.outreachReasons;
  const contextChangesVisibleCount = anyActionsVisible || !contextVisibility.messages;

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

  const loadActionsForDate = useCallback(
    async (villageId: string, date: string) => {
      const requestKey = `${villageId}:${date}`;
      const cached = getCachedDayEvents(villageId, date);
      if (cached) setEvents(cached);
      if (activityRequestKeyRef.current === requestKey) return;

      activityAbortRef.current?.abort();
      const controller = new AbortController();
      activityAbortRef.current = controller;
      activityRequestKeyRef.current = requestKey;
      setLoadingActions(true);
      setError("");

      try {
        const [loadedEvents, loadedSessions] = await Promise.all([
          loadDayEvents(villageId, date, controller.signal),
          loadHumanUseSessions(villageId, date, controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setEvents(loadedEvents);
          setHumanUseSessions(loadedSessions);
        }
      } catch (caughtError) {
        const nextError = messageForError(caughtError);
        if (nextError && !controller.signal.aborted) setError(nextError);
      } finally {
        if (activityRequestKeyRef.current === requestKey) {
          activityRequestKeyRef.current = null;
        }
        if (!controller.signal.aborted) {
          setLoadingActions(false);
          updateTransportLabel();
        }
      }
    },
    [updateTransportLabel],
  );

  const loadVillageBySlug = useCallback(
    async (slug: string) => {
      villageAbortRef.current?.abort();
      dayAbortRef.current?.abort();
      activityAbortRef.current?.abort();
      activityRequestKeyRef.current = null;
      const controller = new AbortController();
      villageAbortRef.current = controller;

      setLoadingVillage(true);
      setLoadingMessages(true);
      setLoadingActions(false);
      setError("");
      setEvents([]);
      setHumanUseSessions([]);
      setMemoryLaunch(null);

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
        if (actionsVisibleRef.current) {
          void loadActionsForDate(loadedVillage.id, loadedVillage.latestDate);
        }
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
    [loadActionsForDate, updateTransportLabel],
  );

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    void loadVillageBySlug(DEFAULT_SLUG);

    return () => {
      villageAbortRef.current?.abort();
      dayAbortRef.current?.abort();
      activityAbortRef.current?.abort();
      activityRequestKeyRef.current = null;
    };
  }, [loadVillageBySlug]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = 0;
  }, [contextVisibility, selectedAgentId, selectedDate, selectedRoomId]);

  const handleSelectDate = useCallback(
    async (date: string, force = false) => {
      if (!village || (!force && date === selectedDate)) return;

      dayAbortRef.current?.abort();
      activityAbortRef.current?.abort();
      activityRequestKeyRef.current = null;
      const controller = new AbortController();
      dayAbortRef.current = controller;

      setSelectedDate(date);
      setMessages([]);
      setEvents([]);
      setHumanUseSessions([]);
      setSelectedRoomId("all");
      setSelectedAgentId("all");
      setMemoryLaunch(null);
      setLoadingMessages(true);
      setLoadingActions(false);
      setError("");

      try {
        const loadedMessages = await loadDayMessages(village, date, controller.signal);
        setMessages(loadedMessages);
        const cachedEvents = getCachedDayEvents(village.id, date);
        if (cachedEvents) setEvents(cachedEvents);
        if (actionsVisibleRef.current) void loadActionsForDate(village.id, date);
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
    [loadActionsForDate, selectedDate, updateTransportLabel, village],
  );

  const clearFilters = useCallback(() => {
    setSelectedRoomId("all");
    setSelectedAgentId("all");
  }, []);

  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedAgentId("all");
  }, []);

  const handleContextToggle = useCallback(
    (key: keyof ContextVisibility) => {
      const next = { ...contextVisibility, [key]: !contextVisibility[key] };
      setContextVisibility(next);
      const nextActionsVisible =
        next.pauses ||
        next.consolidations ||
        next.otherActions ||
        next.humanHelperChat ||
        next.outreachReasons;
      actionsVisibleRef.current = nextActionsVisible;
      if (!nextActionsVisible) {
        activityAbortRef.current?.abort();
        activityRequestKeyRef.current = null;
        setLoadingActions(false);
      } else if (village && selectedDate) {
        void loadActionsForDate(village.id, selectedDate);
      }
    },
    [contextVisibility, loadActionsForDate, selectedDate, village],
  );

  const handleToggleMemories = useCallback(() => {
    if (memoryLaunch) {
      setMemoryLaunch(null);
      return;
    }

    const agentId =
      selectedAgentId !== "all" ? selectedAgentId : (agentOptions[0]?.id ?? village?.agents[0]?.id);
    if (!agentId) return;
    memoryLaunchCounterRef.current += 1;
    setMemoryLaunch({ key: memoryLaunchCounterRef.current, agentId });
  }, [agentOptions, memoryLaunch, selectedAgentId, village?.agents]);

  const handleOpenMemoryPair = useCallback(
    (_activity: ActivityEvent, pair: MemoryPair) => {
      memoryLaunchCounterRef.current += 1;
      setMemoryLaunch({
        key: memoryLaunchCounterRef.current,
        agentId: pair.current.agentId,
        versions: pair.previous ? [pair.current, pair.previous] : [pair.current],
        selectedVersionId: pair.current.id,
      });
    },
    [],
  );

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
              {contextChangesVisibleCount && (
                <span className="timeline-visible-count">
                  {pluralizeItems(timelineItems.length)} visible
                </span>
              )}
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

        <ContextToolbar
          visibility={contextVisibility}
          memoriesOpen={memoryLaunch !== null}
          loadingActions={loadingActions}
          disabled={!village || loadingVillage}
          onToggle={handleContextToggle}
          onToggleMemories={handleToggleMemories}
        />

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
                if (village && selectedDate && anyActionsVisible && events.length === 0) {
                  void loadActionsForDate(village.id, selectedDate);
                } else if (village && selectedDate) void handleSelectDate(selectedDate, true);
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
          <TimelineList
            items={timelineItems}
            rooms={village?.rooms ?? []}
            showRoomLabels={selectedRoomId === "all"}
            loading={loadingMessages}
            onOpenMemoryPair={handleOpenMemoryPair}
          />
        </div>
      </main>

      <MobileFilterDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        {...filtersProps}
      />

      <MemoryInspector
        key={memoryLaunch?.key ?? 0}
        open={memoryLaunch !== null}
        agents={village?.agents ?? []}
        launch={memoryLaunch}
        onClose={() => setMemoryLaunch(null)}
      />
    </div>
  );
}
