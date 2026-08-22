export type DiffLineKind = "equal" | "added" | "removed" | "separator";

export interface DiffLine {
  kind: DiffLineKind;
  content: string;
  oldLine: number | null;
  newLine: number | null;
}

function valueAt(values: Map<number, number>, key: number): number {
  return values.get(key) ?? Number.NEGATIVE_INFINITY;
}

function backtrack(
  trace: Array<Map<number, number>>,
  oldLines: string[],
  newLines: string[],
): DiffLine[] {
  let x = oldLines.length;
  let y = newLines.length;
  const reversed: Array<Omit<DiffLine, "oldLine" | "newLine">> = [];

  for (let depth = trace.length - 1; depth > 0; depth -= 1) {
    const previous = trace[depth - 1]!;
    const diagonal = x - y;
    const previousDiagonal =
      diagonal === -depth ||
      (diagonal !== depth && valueAt(previous, diagonal - 1) < valueAt(previous, diagonal + 1))
        ? diagonal + 1
        : diagonal - 1;
    const previousX = previous.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      reversed.push({ kind: "equal", content: oldLines[x - 1]! });
      x -= 1;
      y -= 1;
    }

    if (x === previousX) {
      reversed.push({ kind: "added", content: newLines[y - 1]! });
      y -= 1;
    } else {
      reversed.push({ kind: "removed", content: oldLines[x - 1]! });
      x -= 1;
    }
  }

  while (x > 0 && y > 0) {
    reversed.push({ kind: "equal", content: oldLines[x - 1]! });
    x -= 1;
    y -= 1;
  }
  while (x > 0) {
    reversed.push({ kind: "removed", content: oldLines[x - 1]! });
    x -= 1;
  }
  while (y > 0) {
    reversed.push({ kind: "added", content: newLines[y - 1]! });
    y -= 1;
  }

  let oldLine = 0;
  let newLine = 0;

  return reversed.reverse().map((line) => {
    if (line.kind !== "added") oldLine += 1;
    if (line.kind !== "removed") newLine += 1;
    return {
      ...line,
      oldLine: line.kind === "added" ? null : oldLine,
      newLine: line.kind === "removed" ? null : newLine,
    };
  });
}

export function diffLines(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent ? newContent.split("\n") : [];
  const maximumDepth = oldLines.length + newLines.length;
  let frontier = new Map<number, number>([[1, 0]]);
  const trace: Array<Map<number, number>> = [];

  for (let depth = 0; depth <= maximumDepth; depth += 1) {
    const nextFrontier = new Map(frontier);

    for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
      let x =
        diagonal === -depth ||
        (diagonal !== depth && valueAt(frontier, diagonal - 1) < valueAt(frontier, diagonal + 1))
          ? (frontier.get(diagonal + 1) ?? 0)
          : (frontier.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;

      while (x < oldLines.length && y < newLines.length && oldLines[x] === newLines[y]) {
        x += 1;
        y += 1;
      }

      nextFrontier.set(diagonal, x);

      if (x >= oldLines.length && y >= newLines.length) {
        trace.push(nextFrontier);
        return backtrack(trace, oldLines, newLines);
      }
    }

    trace.push(nextFrontier);
    frontier = nextFrontier;
  }

  return [];
}

export function compactDiffLines(lines: DiffLine[], context = 3): DiffLine[] {
  const visible = new Set<number>();

  lines.forEach((line, index) => {
    if (line.kind === "equal") return;
    for (let offset = -context; offset <= context; offset += 1) {
      const target = index + offset;
      if (target >= 0 && target < lines.length) visible.add(target);
    }
  });

  if (visible.size === 0 || visible.size === lines.length) return lines;

  const compacted: DiffLine[] = [];
  let previousIndex = -2;

  for (const index of [...visible].sort((a, b) => a - b)) {
    if (index > previousIndex + 1) {
      compacted.push({ kind: "separator", content: "… unchanged lines …", oldLine: null, newLine: null });
    }
    compacted.push(lines[index]!);
    previousIndex = index;
  }

  return compacted;
}
