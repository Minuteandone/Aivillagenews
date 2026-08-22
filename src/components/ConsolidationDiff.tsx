import { useEffect, useState } from "react";
import { loadConsolidationMemoryPair } from "../lib/api";
import type { ActivityEvent, MemoryPair } from "../types";
import { MemoryDiff } from "./MemoryDiff";

interface ConsolidationDiffProps {
  activity: ActivityEvent;
  onOpenVersion: (pair: MemoryPair) => void;
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error ? error.message : "The memory comparison could not be loaded.";
}

export function ConsolidationDiff({ activity, onOpenVersion }: ConsolidationDiffProps) {
  const [pair, setPair] = useState<MemoryPair | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    void loadConsolidationMemoryPair(activity.agentId, activity.createdAt, controller.signal)
      .then((loadedPair) => {
        if (!controller.signal.aborted) setPair(loadedPair);
      })
      .catch((caughtError: unknown) => {
        const message = errorMessage(caughtError);
        if (message && !controller.signal.aborted) setError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [activity.agentId, activity.createdAt]);

  if (loading) {
    return <div className="consolidation-diff-status">Loading the before-and-after memories…</div>;
  }

  if (error || !pair) {
    return <div className="consolidation-diff-status consolidation-diff-status--error">{error || "No memory comparison is available."}</div>;
  }

  return (
    <MemoryDiff
      current={pair.current}
      previous={pair.previous}
      onOpenVersion={() => onOpenVersion(pair)}
    />
  );
}
