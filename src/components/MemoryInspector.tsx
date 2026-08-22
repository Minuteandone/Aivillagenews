import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadAgentMemories } from "../lib/api";
import { formatMemoryTimestamp } from "../lib/format";
import type { ApiAgent, MemoryVersion } from "../types";
import { CloseIcon, HistoryIcon } from "./Icons";
import { MemoryDiff } from "./MemoryDiff";
import { MemoryDocument } from "./MemoryDocument";

export interface MemoryLaunch {
  key: number;
  agentId: string;
  versions?: MemoryVersion[];
  selectedVersionId?: string;
}

interface MemoryInspectorProps {
  open: boolean;
  agents: ApiAgent[];
  launch: MemoryLaunch | null;
  onClose: () => void;
}

function uniqueVersions(versions: MemoryVersion[]): MemoryVersion[] {
  return [...new Map(versions.map((version) => [version.id, version])).values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error ? error.message : "The memory archive could not be loaded.";
}

export function MemoryInspector({ open, agents, launch, onClose }: MemoryInspectorProps) {
  const initialAgentId = launch?.agentId || agents[0]?.id || "";
  const initialVersions = launch?.versions?.length ? uniqueVersions(launch.versions) : [];
  const [selectedAgentId, setSelectedAgentId] = useState(initialAgentId);
  const [versions, setVersions] = useState<MemoryVersion[]>(initialVersions);
  const [selectedVersionId, setSelectedVersionId] = useState(
    launch?.selectedVersionId ?? initialVersions[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(initialVersions.length === 0 && Boolean(initialAgentId));
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [viewingHistoricalSeed, setViewingHistoricalSeed] = useState(initialVersions.length > 0);
  const abortRef = useRef<AbortController | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const selectedVersionIndex = versions.findIndex((version) => version.id === selectedVersionId);
  const selectedVersion = versions[selectedVersionIndex] ?? versions[0] ?? null;
  const previousVersion =
    selectedVersionIndex >= 0 ? (versions[selectedVersionIndex + 1] ?? null) : null;
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? null;

  const loadLatest = useCallback(async (agentId: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    setCompareMode(false);
    setViewingHistoricalSeed(false);

    try {
      const loaded = await loadAgentMemories(agentId, undefined, controller.signal);
      if (controller.signal.aborted) return;
      setVersions(loaded);
      setSelectedVersionId(loaded[0]?.id ?? "");
      setHasMore(loaded.length === 10);
    } catch (caughtError) {
      const message = errorMessage(caughtError);
      if (message) setError(message);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!initialAgentId) return;

    let controller: AbortController | null = null;
    if (initialVersions.length === 0) {
      controller = new AbortController();
      abortRef.current = controller;
      void loadAgentMemories(initialAgentId, undefined, controller.signal)
        .then((loaded) => {
          if (controller?.signal.aborted) return;
          setVersions(loaded);
          setSelectedVersionId(loaded[0]?.id ?? "");
          setHasMore(loaded.length === 10);
        })
        .catch((caughtError: unknown) => {
          const message = errorMessage(caughtError);
          if (message && !controller?.signal.aborted) setError(message);
        })
        .finally(() => {
          if (!controller?.signal.aborted) setLoading(false);
        });
    }

    window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => controller?.abort();
  }, [initialAgentId, initialVersions.length, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    setVersions([]);
    setSelectedVersionId("");
    void loadLatest(agentId);
  };

  const loadOlder = async () => {
    const oldest = versions.at(-1);
    if (!selectedAgentId || !oldest || loadingOlder) return;
    setLoadingOlder(true);
    setError("");

    try {
      const cutoff = new Date(oldest.createdAt).getTime() - 1;
      const loaded = await loadAgentMemories(selectedAgentId, cutoff);
      setVersions((current) => uniqueVersions([...current, ...loaded]));
      setHasMore(loaded.length === 10);
    } catch (caughtError) {
      const message = errorMessage(caughtError);
      if (message) setError(message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const title = useMemo(
    () => `${selectedAgent?.name ?? "Agent"} · Memory`,
    [selectedAgent?.name],
  );

  if (!open) return null;

  return (
    <div className="memory-inspector-layer">
      <button
        type="button"
        className="memory-inspector-backdrop"
        aria-label="Close memory browser"
        onClick={onClose}
      />
      <aside className="memory-inspector" role="dialog" aria-modal="true" aria-label={title}>
        <div className="memory-inspector__handle" aria-hidden="true" />
        <header className="memory-inspector__header">
          <label>
            <span className="sr-only">Memory agent</span>
            <select
              aria-label="Memory agent"
              value={selectedAgentId}
              onChange={(event) => handleAgentChange(event.target.value)}
            >
              {agents.map((agent) => (
                <option value={agent.id} key={agent.id}>
                  {agent.name} · Memory
                </option>
              ))}
            </select>
          </label>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button memory-inspector__close"
            aria-label="Close memory browser"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="memory-inspector__body">
          <nav className="memory-version-list" aria-label="Memory versions">
            {versions.map((version, index) => (
              <button
                type="button"
                aria-current={version.id === selectedVersion?.id ? "true" : undefined}
                onClick={() => {
                  setSelectedVersionId(version.id);
                  setCompareMode(false);
                }}
                key={version.id}
              >
                <strong>{index === 0 && !viewingHistoricalSeed ? "Latest" : "Saved memory"}</strong>
                <span>{formatMemoryTimestamp(version.createdAt)}</span>
              </button>
            ))}
          </nav>

          <div className="memory-inspector__document">
            {loading && <div className="memory-inspector__status">Loading memory versions…</div>}
            {!loading && error && <div className="memory-inspector__status memory-inspector__status--error">{error}</div>}
            {!loading && !error && !selectedVersion && (
              <div className="memory-inspector__status">No saved memories were found for this agent.</div>
            )}
            {selectedVersion && (
              <>
                <div className="memory-inspector__date">
                  <HistoryIcon />
                  {formatMemoryTimestamp(selectedVersion.createdAt)}
                </div>
                {compareMode ? (
                  <MemoryDiff current={selectedVersion} previous={previousVersion} />
                ) : (
                  <MemoryDocument content={selectedVersion.content} />
                )}
              </>
            )}
          </div>
        </div>

        <footer className="memory-inspector__footer">
          {viewingHistoricalSeed && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadLatest(selectedAgentId)}
            >
              View latest
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            disabled={!selectedVersion || !previousVersion}
            onClick={() => setCompareMode((value) => !value)}
          >
            {compareMode ? "View memory" : "Compare with previous"}
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!hasMore || loadingOlder || versions.length === 0}
            onClick={() => void loadOlder()}
          >
            {loadingOlder ? "Loading older versions…" : hasMore ? "Load older versions" : "All versions loaded"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
