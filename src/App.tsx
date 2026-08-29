import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ContextToolbar,
  type ContextVisibility,
} from "./components/ContextToolbar";
import { AgentProfilePage } from "./components/AgentProfilePage";
import { FiltersPanel } from "./components/FiltersPanel";
import { GitHistoryList } from "./components/GitHistoryList";
import { GitHistoryToolbar } from "./components/GitHistoryToolbar";
import { ClearFilterIcon, DownloadIcon, FilterIcon, HashIcon } from "./components/Icons";
import {
  MemoryInspector,
  type MemoryLaunch,
} from "./components/MemoryInspector";
import { TimelineList } from "./components/MessageList";
import { MobileFilterDrawer } from "./components/MobileFilterDrawer";
import { ViewSwitcher, type ArchiveView } from "./components/ViewSwitcher";
import { buildTimelineItems, mapEventsToActivities } from "./lib/activities";
import { agentHash, parseAgentHash } from "./lib/agentRoutes";
import { buildDayMessagesExport, downloadDayMessagesExport } from "./lib/dayExport";
import {
  activeTransport,
  agentPageSlug,
  getCachedDayEvents,
  loadAgentProfilesIndex,
  loadDayEvents,
  loadDayMessages,
  loadHumanUseSessions,
  loadVillage,
} from "./lib/api";
import { formatDateLong, pluralizeItems, pluralizeMessages } from "./lib/format";
import {
  buildGitAuthorOptions,
  buildGitProjectOptions,
  filterGitCommits,
  loadGitHistory,
} from "./lib/gitHistory";
import {
  buildAgentOptions,
  buildRoomOptions,
  filterMessages,
} from "./lib/messages";
import type {
  ActivityEvent,
  AgentProfilesIndex,
  ApiEvent,
  ChatMessage,
  GitHistoryResult,
  GitPlatform,
  HumanUseSession,
  MemoryPair,
  VillageData,
} from "./types";

const DEFAULT_SLUG = "actual-launch-1";

interface DayExportStatus {
  kind: "idle" | "loading" | "success" | "error";
  message: string;
}

const IDLE_DAY_EXPORT: DayExportStatus = { kind: "idle", message: "" };

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
  const [selectedProfileAgentId, setSelectedProfileAgentId] = useState("");
  const [agentProfilesIndex, setAgentProfilesIndex] = useState<AgentProfilesIndex | null>(null);
  const [loadingAgentProfiles, setLoadingAgentProfiles] = useState(false);
  const [agentProfilesError, setAgentProfilesError] = useState("");
  const [viewMode, setViewMode] = useState<ArchiveView>("timeline");
  const [gitHistoryResult, setGitHistoryResult] = useState<GitHistoryResult | null>(null);
  const [gitSources, setGitSources] = useState<Record<GitPlatform, boolean>>({
    github: true,
    gitlab: true,
  });
  const [selectedGitProjectId, setSelectedGitProjectId] = useState("all");
  const [selectedGitAuthorId, setSelectedGitAuthorId] = useState("all");
  const [gitSearch, setGitSearch] = useState("");
  const [gitSort, setGitSort] = useState<"asc" | "desc">("desc");
  const [loadingVillage, setLoadingVillage] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [loadingGitHistory, setLoadingGitHistory] = useState(false);
  const [gitLoadingMessage, setGitLoadingMessage] = useState("Loading Git history…");
  const [error, setError] = useState("");
  const [gitError, setGitError] = useState("");
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
  const [dayExportStatus, setDayExportStatus] = useState<DayExportStatus>(IDLE_DAY_EXPORT);

  const villageAbortRef = useRef<AbortController | null>(null);
  const dayAbortRef = useRef<AbortController | null>(null);
  const activityAbortRef = useRef<AbortController | null>(null);
  const gitHistoryAbortRef = useRef<AbortController | null>(null);
  const agentProfilesAbortRef = useRef<AbortController | null>(null);
  const dayExportAbortRef = useRef<AbortController | null>(null);
  const activityRequestKeyRef = useRef<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const didInitialLoadRef = useRef(false);
  const memoryLaunchCounterRef = useRef(0);
  const actionsVisibleRef = useRef(false);
  const viewModeRef = useRef<ArchiveView>("timeline");

  const roomOptions = useMemo(
    () => buildRoomOptions(messages, village?.rooms ?? []),
    [messages, village?.rooms],
  );

  const agentOptions = useMemo(
    () => buildAgentOptions(messages, village?.agents ?? [], selectedRoomId),
    [messages, selectedRoomId, village?.agents],
  );

  const profileAgentOptions = useMemo(
    () =>
      (village?.agents ?? []).map((agent) => ({
        id: agent.id,
        name: agent.name,
        count: agentProfilesIndex?.profiles[agent.id]?.humanHelperRequests.length ?? 0,
      })),
    [agentProfilesIndex?.profiles, village?.agents],
  );

  const selectedProfileAgent = useMemo(
    () =>
      village?.agents.find((agent) => agent.id === selectedProfileAgentId) ??
      village?.agents[0] ??
      null,
    [selectedProfileAgentId, village?.agents],
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

  const gitCommits = useMemo(
    () => gitHistoryResult?.commits ?? [],
    [gitHistoryResult],
  );

  const gitSourceCounts = useMemo(
    () => ({
      github: gitCommits.filter((commit) => commit.platform === "github").length,
      gitlab: gitCommits.filter((commit) => commit.platform === "gitlab").length,
    }),
    [gitCommits],
  );

  const gitProjectOptions = useMemo(
    () => buildGitProjectOptions(gitCommits, gitSources),
    [gitCommits, gitSources],
  );

  const gitAuthorOptions = useMemo(
    () => buildGitAuthorOptions(gitCommits, gitSources, selectedGitProjectId),
    [gitCommits, gitSources, selectedGitProjectId],
  );

  const visibleGitCommits = useMemo(
    () =>
      filterGitCommits(gitCommits, {
        sources: gitSources,
        projectId: selectedGitProjectId,
        authorId: selectedGitAuthorId,
        search: gitSearch,
        sort: gitSort,
      }),
    [gitCommits, gitSearch, gitSort, gitSources, selectedGitAuthorId, selectedGitProjectId],
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

  const selectedGitProjectName = useMemo(
    () =>
      selectedGitProjectId === "all"
        ? ""
        : (gitProjectOptions.find((project) => project.id === selectedGitProjectId)?.path ??
          "Unknown project"),
    [gitProjectOptions, selectedGitProjectId],
  );

  const selectedGitAuthorName = useMemo(
    () =>
      selectedGitAuthorId === "all"
        ? ""
        : (gitAuthorOptions.find((author) => author.id === selectedGitAuthorId)?.name ??
          "Unknown author"),
    [gitAuthorOptions, selectedGitAuthorId],
  );

  const timelineHasActiveFilters = selectedRoomId !== "all" || selectedAgentId !== "all";
  const gitHasActiveFilters =
    !gitSources.github ||
    !gitSources.gitlab ||
    selectedGitProjectId !== "all" ||
    selectedGitAuthorId !== "all" ||
    gitSearch.trim().length > 0;
  const hasActiveFilters =
    viewMode === "git" ? gitHasActiveFilters : viewMode === "timeline" && timelineHasActiveFilters;

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

  const loadAgentProfilesForVillage = useCallback(async (villageId: string) => {
    agentProfilesAbortRef.current?.abort();
    const controller = new AbortController();
    agentProfilesAbortRef.current = controller;
    setLoadingAgentProfiles(true);
    setAgentProfilesError("");

    try {
      const index = await loadAgentProfilesIndex(villageId, controller.signal);
      if (!controller.signal.aborted) setAgentProfilesIndex(index);
    } catch (caughtError) {
      const nextError = messageForError(caughtError);
      if (nextError && !controller.signal.aborted) setAgentProfilesError(nextError);
    } finally {
      if (!controller.signal.aborted) setLoadingAgentProfiles(false);
    }
  }, []);

  const loadGitHistoryForDate = useCallback(async (date: string, force = false) => {
    gitHistoryAbortRef.current?.abort();
    const controller = new AbortController();
    gitHistoryAbortRef.current = controller;
    setLoadingGitHistory(true);
    setGitLoadingMessage("Loading GitHub and GitLab history…");
    setGitError("");

    try {
      const result = await loadGitHistory(
        date,
        controller.signal,
        (message) => {
          if (!controller.signal.aborted) setGitLoadingMessage(message);
        },
        force,
      );
      if (!controller.signal.aborted) setGitHistoryResult(result);
    } catch (caughtError) {
      const nextError = messageForError(caughtError);
      if (nextError && !controller.signal.aborted) setGitError(nextError);
    } finally {
      if (!controller.signal.aborted) setLoadingGitHistory(false);
    }
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
      gitHistoryAbortRef.current?.abort();
      agentProfilesAbortRef.current?.abort();
      dayExportAbortRef.current?.abort();
      activityRequestKeyRef.current = null;
      const controller = new AbortController();
      villageAbortRef.current = controller;

      setLoadingVillage(true);
      setLoadingMessages(true);
      setLoadingActions(false);
      setLoadingGitHistory(false);
      setError("");
      setGitError("");
      setAgentProfilesError("");
      setAgentProfilesIndex(null);
      setLoadingAgentProfiles(false);
      setEvents([]);
      setHumanUseSessions([]);
      setGitHistoryResult(null);
      setSelectedGitProjectId("all");
      setSelectedGitAuthorId("all");
      setGitSearch("");
      setMemoryLaunch(null);
      setDayExportStatus(IDLE_DAY_EXPORT);

      try {
        const loadedVillage = await loadVillage(slug, controller.signal);
        setVillage(loadedVillage);
        setSlugInput(loadedVillage.slug);
        setSelectedDate(loadedVillage.latestDate);
        setMessages(loadedVillage.latestMessages);
        setSelectedRoomId("all");
        setSelectedAgentId("all");
        setSelectedProfileAgentId(loadedVillage.agents[0]?.id ?? "");
        setDayMessageCounts(
          new Map([[loadedVillage.latestDate, loadedVillage.latestMessages.length]]),
        );
        if (actionsVisibleRef.current) {
          void loadActionsForDate(loadedVillage.id, loadedVillage.latestDate);
        }
        if (viewModeRef.current === "git") {
          void loadGitHistoryForDate(loadedVillage.latestDate);
        }
        if (viewModeRef.current === "agents") {
          void loadAgentProfilesForVillage(loadedVillage.id);
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
    [loadActionsForDate, loadAgentProfilesForVillage, loadGitHistoryForDate, updateTransportLabel],
  );

  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    void loadVillageBySlug(DEFAULT_SLUG);

    return () => {
      villageAbortRef.current?.abort();
      dayAbortRef.current?.abort();
      activityAbortRef.current?.abort();
      gitHistoryAbortRef.current?.abort();
      agentProfilesAbortRef.current?.abort();
      dayExportAbortRef.current?.abort();
      activityRequestKeyRef.current = null;
    };
  }, [loadVillageBySlug]);

  useEffect(() => {
    if (!village) return;

    const applyHashRoute = () => {
      const route = parseAgentHash(window.location.hash);
      if (!route) {
        if (viewModeRef.current === "agents") {
          viewModeRef.current = "timeline";
          setViewMode("timeline");
          setMemoryLaunch(null);
        }
        return;
      }

      const agent = village.agents.find((candidate) => agentPageSlug(candidate.name) === route.slug);
      if (!agent) return;

      viewModeRef.current = "agents";
      setViewMode("agents");
      setSelectedProfileAgentId(agent.id);
      setSelectedAgentId(agent.id);
      setMobileFiltersOpen(false);
      void loadAgentProfilesForVillage(village.id);

      if (route.memory) {
        memoryLaunchCounterRef.current += 1;
        setMemoryLaunch({ key: memoryLaunchCounterRef.current, agentId: agent.id });
      } else {
        setMemoryLaunch(null);
      }
    };

    applyHashRoute();
    window.addEventListener("hashchange", applyHashRoute);
    window.addEventListener("popstate", applyHashRoute);
    return () => {
      window.removeEventListener("hashchange", applyHashRoute);
      window.removeEventListener("popstate", applyHashRoute);
    };
  }, [loadAgentProfilesForVillage, village]);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = 0;
  }, [
    contextVisibility,
    gitSearch,
    gitSort,
    gitSources,
    selectedAgentId,
    selectedProfileAgentId,
    selectedDate,
    selectedGitAuthorId,
    selectedGitProjectId,
    selectedRoomId,
    viewMode,
  ]);

  const handleSelectDate = useCallback(
    async (date: string, force = false) => {
      if (!village || (!force && date === selectedDate)) return;

      dayAbortRef.current?.abort();
      activityAbortRef.current?.abort();
      gitHistoryAbortRef.current?.abort();
      dayExportAbortRef.current?.abort();
      activityRequestKeyRef.current = null;
      const controller = new AbortController();
      dayAbortRef.current = controller;

      setSelectedDate(date);
      setMessages([]);
      setEvents([]);
      setHumanUseSessions([]);
      setGitHistoryResult(null);
      setSelectedRoomId("all");
      setSelectedAgentId("all");
      setSelectedGitProjectId("all");
      setSelectedGitAuthorId("all");
      setGitSearch("");
      setMemoryLaunch(null);
      setDayExportStatus(IDLE_DAY_EXPORT);
      setLoadingMessages(true);
      setLoadingActions(false);
      setError("");
      setGitError("");

      if (viewModeRef.current === "git") {
        void loadGitHistoryForDate(date, force);
      }

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
    [loadActionsForDate, loadGitHistoryForDate, selectedDate, updateTransportLabel, village],
  );

  const clearFilters = useCallback(() => {
    if (viewModeRef.current === "git") {
      setGitSources({ github: true, gitlab: true });
      setSelectedGitProjectId("all");
      setSelectedGitAuthorId("all");
      setGitSearch("");
      return;
    }

    setSelectedRoomId("all");
    setSelectedAgentId("all");
  }, []);

  const handleSelectRoom = useCallback((roomId: string) => {
    setSelectedRoomId(roomId);
    setSelectedAgentId("all");
  }, []);

  const handleToggleGitSource = useCallback((platform: GitPlatform) => {
    setGitSources((current) => ({ ...current, [platform]: !current[platform] }));
    setSelectedGitProjectId("all");
    setSelectedGitAuthorId("all");
  }, []);

  const handleSelectGitProject = useCallback((projectId: string) => {
    setSelectedGitProjectId(projectId);
    setSelectedGitAuthorId("all");
  }, []);

  const handleSelectProfileAgent = useCallback(
    (agentId: string) => {
      const agent = village?.agents.find((candidate) => candidate.id === agentId);
      if (!agent || !village) return;

      viewModeRef.current = "agents";
      setViewMode("agents");
      setSelectedProfileAgentId(agent.id);
      setMobileFiltersOpen(false);
      setMemoryLaunch(null);
      void loadAgentProfilesForVillage(village.id);

      const nextHash = agentHash(agent.name);
      if (window.location.hash !== nextHash) window.location.hash = nextHash;
    },
    [loadAgentProfilesForVillage, village],
  );

  const handleViewModeChange = useCallback(
    (nextView: ArchiveView) => {
      viewModeRef.current = nextView;
      setViewMode(nextView);
      setError("");
      setGitError("");
      setMobileFiltersOpen(false);
      setMemoryLaunch(null);

      if (nextView === "git" && selectedDate && !gitHistoryResult) {
        void loadGitHistoryForDate(selectedDate);
      }
      if (nextView === "agents" && village) {
        const nextAgentId =
          selectedProfileAgentId ||
          (selectedAgentId !== "all" ? selectedAgentId : village.agents[0]?.id) ||
          "";
        const nextAgent = village.agents.find((agent) => agent.id === nextAgentId);
        setSelectedProfileAgentId(nextAgentId);
        void loadAgentProfilesForVillage(village.id);
        if (nextAgent) {
          const nextHash = agentHash(nextAgent.name);
          if (window.location.hash !== nextHash) window.location.hash = nextHash;
        }
      } else if (parseAgentHash(window.location.hash)) {
        window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
      }
    },
    [
      gitHistoryResult,
      loadAgentProfilesForVillage,
      loadGitHistoryForDate,
      selectedAgentId,
      selectedDate,
      selectedProfileAgentId,
      village,
    ],
  );

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

  const handleOpenProfileMemory = useCallback(() => {
    if (!selectedProfileAgent) return;
    memoryLaunchCounterRef.current += 1;
    setMemoryLaunch({
      key: memoryLaunchCounterRef.current,
      agentId: selectedProfileAgent.id,
    });
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${agentHash(selectedProfileAgent.name, true)}`,
    );
  }, [selectedProfileAgent]);

  const handleCloseMemory = useCallback(() => {
    setMemoryLaunch(null);
    if (viewModeRef.current === "agents" && selectedProfileAgent) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${agentHash(selectedProfileAgent.name)}`,
      );
    }
  }, [selectedProfileAgent]);

  const handleDownloadDayMessages = useCallback(async () => {
    if (!village || !selectedDate || dayExportStatus.kind === "loading") return;

    dayExportAbortRef.current?.abort();
    const controller = new AbortController();
    dayExportAbortRef.current = controller;
    setDayExportStatus({
      kind: "loading",
      message: `Collecting every message from ${formatDateLong(selectedDate)}…`,
    });

    try {
      const loadedEvents = await loadDayEvents(village.id, selectedDate, controller.signal);
      if (controller.signal.aborted) return;

      const archive = buildDayMessagesExport(village, selectedDate, loadedEvents);
      const downloaded = downloadDayMessagesExport(archive);
      setEvents(loadedEvents);
      setDayExportStatus({
        kind: "success",
        message: `Downloaded ${pluralizeMessages(archive.day.messageCount)} as ${downloaded.filename}.`,
      });
    } catch (caughtError) {
      const nextError = messageForError(caughtError);
      if (nextError && !controller.signal.aborted) {
        setDayExportStatus({ kind: "error", message: nextError });
      }
    }
  }, [dayExportStatus.kind, selectedDate, village]);

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
    agents: viewMode === "agents" ? profileAgentOptions : agentOptions,
    selectedAgentId: viewMode === "agents" ? selectedProfileAgentId : selectedAgentId,
    onSelectAgent: viewMode === "agents" ? handleSelectProfileAgent : setSelectedAgentId,
    totalMessages: messages.length,
    roomMessageCount,
    transportLabel:
      viewMode === "git"
        ? "Public read-only GitHub and GitLab APIs"
        : viewMode === "agents"
          ? "Daily profile index + live Village stories"
        : transportLabel,
    viewMode,
    gitSources,
    gitSourceCounts,
    onToggleGitSource: handleToggleGitSource,
    gitProjects: gitProjectOptions,
    selectedGitProjectId,
    onSelectGitProject: handleSelectGitProject,
    gitAuthors: gitAuthorOptions,
    selectedGitAuthorId,
    onSelectGitAuthor: setSelectedGitAuthorId,
  };
  const visibleError = viewMode === "git" ? gitError : viewMode === "timeline" ? error : "";

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
            <h1>
              {viewMode === "agents"
                ? "Agent pages"
                : selectedDate
                  ? formatDateLong(selectedDate)
                  : "Choose a village"}
            </h1>
            <div className="transcript-header__meta">
              {viewMode === "timeline" ? (
                <>
                  <span>{selectedRoomId === "all" ? "All rooms" : `#${selectedRoomName}`}</span>
                  <span aria-hidden="true">•</span>
                  <span>{pluralizeMessages(visibleMessages.length)}</span>
                  {timelineHasActiveFilters && visibleMessages.length !== messages.length && (
                    <span className="muted-total">of {pluralizeMessages(messages.length)}</span>
                  )}
                  {selectedAgentName && <span className="active-agent-label">{selectedAgentName}</span>}
                  {contextChangesVisibleCount && (
                    <span className="timeline-visible-count">
                      {pluralizeItems(timelineItems.length)} visible
                    </span>
                  )}
                </>
              ) : viewMode === "git" ? (
                <>
                  <span>GitHub + GitLab</span>
                  <span aria-hidden="true">•</span>
                  <span>{visibleGitCommits.length.toLocaleString()} {visibleGitCommits.length === 1 ? "commit" : "commits"}</span>
                  {gitHasActiveFilters && visibleGitCommits.length !== gitCommits.length && (
                    <span className="muted-total">of {gitCommits.length.toLocaleString()}</span>
                  )}
                  {selectedGitProjectName && <span className="active-agent-label">{selectedGitProjectName}</span>}
                  {selectedGitAuthorName && <span className="active-agent-label">{selectedGitAuthorName}</span>}
                </>
              ) : (
                <>
                  <span>{village?.agents.length.toLocaleString() ?? 0} agent pages</span>
                  {selectedProfileAgent && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span className="active-agent-label">{selectedProfileAgent.name}</span>
                    </>
                  )}
                  {agentProfilesIndex && (
                    <span className="timeline-visible-count">
                      indexed through {formatDateLong(agentProfilesIndex.indexedThroughDate)}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="transcript-header__actions">
            <ViewSwitcher
              value={viewMode}
              onChange={handleViewModeChange}
              disabled={!village || loadingVillage}
            />
            {viewMode !== "agents" && (
              <button
                type="button"
                className="secondary-button day-export-button"
                onClick={() => void handleDownloadDayMessages()}
                disabled={
                  !village ||
                  !selectedDate ||
                  loadingVillage ||
                  dayExportStatus.kind === "loading"
                }
                title={selectedDate ? `Download every message from ${selectedDate} as JSON` : undefined}
              >
                <DownloadIcon />
                <span className="day-export-button__label">
                  {dayExportStatus.kind === "loading" ? "Preparing JSON…" : "Download JSON"}
                </span>
              </button>
            )}
            {viewMode !== "agents" && (
              <button
                type="button"
                className="secondary-button clear-filter-button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                <ClearFilterIcon />
                Clear filters
              </button>
            )}
          </div>
        </header>

        {viewMode === "timeline" ? (
          <ContextToolbar
            visibility={contextVisibility}
            memoriesOpen={memoryLaunch !== null}
            loadingActions={loadingActions}
            disabled={!village || loadingVillage}
            onToggle={handleContextToggle}
            onToggleMemories={handleToggleMemories}
          />
        ) : viewMode === "git" ? (
          <GitHistoryToolbar
            search={gitSearch}
            onSearchChange={setGitSearch}
            sources={gitSources}
            onToggleSource={handleToggleGitSource}
            sort={gitSort}
            onToggleSort={() => setGitSort((current) => current === "desc" ? "asc" : "desc")}
            loading={loadingGitHistory}
            loadingMessage={gitLoadingMessage}
            disabled={!village || loadingVillage}
            onReload={() => selectedDate && void loadGitHistoryForDate(selectedDate, true)}
          />
        ) : null}

        {viewMode === "timeline" && <nav className="mobile-room-switcher" aria-label="Rooms">
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
        </nav>}

        {visibleError && (
          <div className="status-banner status-banner--error" role="alert">
            <span>{visibleError}</span>
            <button
              type="button"
              onClick={() => {
                if (viewMode === "git" && selectedDate) {
                  void loadGitHistoryForDate(selectedDate, true);
                } else if (village && selectedDate && anyActionsVisible && events.length === 0) {
                  void loadActionsForDate(village.id, selectedDate);
                } else if (village && selectedDate) void handleSelectDate(selectedDate, true);
                else void loadVillageBySlug(slugInput);
              }}
            >
              Retry
            </button>
          </div>
        )}

        {viewMode !== "agents" && dayExportStatus.kind !== "idle" && (
          <div
            className={`status-banner day-export-status day-export-status--${dayExportStatus.kind}`}
            role={dayExportStatus.kind === "error" ? "alert" : "status"}
          >
            <span>{dayExportStatus.message}</span>
            {dayExportStatus.kind === "error" ? (
              <button type="button" onClick={() => void handleDownloadDayMessages()}>
                Retry
              </button>
            ) : dayExportStatus.kind === "success" ? (
              <button type="button" onClick={() => setDayExportStatus(IDLE_DAY_EXPORT)}>
                Dismiss
              </button>
            ) : null}
          </div>
        )}

        {viewMode === "timeline" && loadingMessages && selectedDate && (
          <div className="status-banner" role="status">
            Reading Day {selectedDate} from the public archive… Historical days can take a moment.
          </div>
        )}

        <div className="transcript-scroll" ref={transcriptRef}>
          {viewMode === "timeline" ? (
            <TimelineList
              items={timelineItems}
              rooms={village?.rooms ?? []}
              showRoomLabels={selectedRoomId === "all"}
              loading={loadingMessages}
              onOpenMemoryPair={handleOpenMemoryPair}
              onOpenAgent={handleSelectProfileAgent}
            />
          ) : viewMode === "git" ? (
            <GitHistoryList
              commits={visibleGitCommits}
              result={gitHistoryResult}
              loading={loadingGitHistory}
            />
          ) : selectedProfileAgent ? (
            <AgentProfilePage
              agent={selectedProfileAgent}
              rooms={village?.rooms ?? []}
              profileIndex={agentProfilesIndex}
              loadingProfileIndex={loadingAgentProfiles}
              profileIndexError={agentProfilesError}
              onOpenMemory={handleOpenProfileMemory}
            />
          ) : (
            <div className="empty-transcript">
              <div className="empty-transcript__mark" aria-hidden="true" />
              <h2>No agent selected</h2>
              <p>Choose an agent page from the sidebar.</p>
            </div>
          )}
        </div>
      </main>

      <MobileFilterDrawer
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        {...filtersProps}
      />

      <MemoryInspector
        key={memoryLaunch?.key ?? 0}
        open={viewMode !== "git" && memoryLaunch !== null}
        agents={village?.agents ?? []}
        launch={memoryLaunch}
        onClose={handleCloseMemory}
      />
    </div>
  );
}
