import { useMemo, useState } from "react";
import { compactDiffLines, diffLines } from "../lib/diff";
import type { MemoryVersion } from "../types";

interface MemoryDiffProps {
  current: MemoryVersion;
  previous: MemoryVersion | null;
  onOpenVersion?: () => void;
}

export function MemoryDiff({ current, previous, onOpenVersion }: MemoryDiffProps) {
  const [showAll, setShowAll] = useState(false);
  const lines = useMemo(
    () => diffLines(previous?.content ?? "", current.content),
    [current.content, previous?.content],
  );
  const additions = useMemo(
    () => lines.reduce((total, line) => total + Number(line.kind === "added"), 0),
    [lines],
  );
  const removals = useMemo(
    () => lines.reduce((total, line) => total + Number(line.kind === "removed"), 0),
    [lines],
  );
  const visibleLines = useMemo(
    () => (showAll ? lines : compactDiffLines(lines)),
    [lines, showAll],
  );

  return (
    <section className="memory-diff" aria-label="Memory changes">
      <header className="memory-diff__header">
        <div className="memory-diff__title-row">
          <strong>Memory changes</strong>
          <span className="memory-diff__additions">+{additions} additions</span>
          <span className="memory-diff__removals">−{removals} removals</span>
        </div>
        <div className="memory-diff__actions">
          <button type="button" onClick={() => setShowAll((value) => !value)}>
            {showAll ? "Hide unchanged" : "Show all lines"}
          </button>
          {onOpenVersion && (
            <button type="button" onClick={onOpenVersion}>
              Open version
            </button>
          )}
        </div>
      </header>
      {!previous && (
        <p className="memory-diff__notice">This is the first saved memory available before this consolidation.</p>
      )}
      <div className="memory-diff__viewport" tabIndex={0}>
        <ol className="memory-diff__lines">
          {visibleLines.map((line, index) => (
            <li className={`memory-diff__line memory-diff__line--${line.kind}`} key={`${index}-${line.kind}`}>
              <span className="memory-diff__line-number">
                {line.kind === "separator" ? "" : (line.newLine ?? line.oldLine ?? "")}
              </span>
              <span className="memory-diff__marker" aria-hidden="true">
                {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
              </span>
              <code>{line.content || " "}</code>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
