import { Fragment, type ReactNode } from "react";

const INLINE_PATTERN = /(\[[^\]]+\]\(https?:\/\/[^)]+\)|\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s]+)/g;

function trimUrlPunctuation(value: string): [string, string] {
  const match = value.match(/^(.*?)([.,!?;:]+)?$/);
  return [match?.[1] ?? value, match?.[2] ?? ""];
}

function renderInline(value: string): ReactNode[] {
  return value.split(INLINE_PATTERN).map((piece, index) => {
    const markdownLink = piece.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
    if (markdownLink) {
      return (
        <a
          href={markdownLink[2]}
          target="_blank"
          rel="noreferrer noopener"
          key={`${index}-${markdownLink[2]}`}
        >
          {markdownLink[1]}
        </a>
      );
    }
    if (piece.startsWith("**") && piece.endsWith("**")) {
      return <strong key={`${index}-${piece.slice(0, 12)}`}>{piece.slice(2, -2)}</strong>;
    }
    if (piece.startsWith("`") && piece.endsWith("`")) {
      return <code key={`${index}-${piece.slice(0, 12)}`}>{piece.slice(1, -1)}</code>;
    }
    if (piece.startsWith("http://") || piece.startsWith("https://")) {
      const [url, punctuation] = trimUrlPunctuation(piece);
      return (
        <Fragment key={`${index}-${url}`}>
          <a href={url} target="_blank" rel="noreferrer noopener">
            {url}
          </a>
          {punctuation}
        </Fragment>
      );
    }
    return <Fragment key={`${index}-${piece.slice(0, 12)}`}>{piece}</Fragment>;
  });
}

interface MemoryBlock {
  kind: "heading" | "paragraph" | "bullet" | "quote" | "code" | "space";
  content: string;
  level?: number;
}

function parseBlocks(content: string): MemoryBlock[] {
  const blocks: MemoryBlock[] = [];
  const lines = content.split("\n");
  let codeLines: string[] | null = null;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      if (codeLines) {
        blocks.push({ kind: "code", content: codeLines.join("\n") });
        codeLines = null;
      } else {
        codeLines = [];
      }
      continue;
    }

    if (codeLines) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1]!.length, content: heading[2]! });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      blocks.push({ kind: "bullet", content: line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "") });
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      blocks.push({ kind: "quote", content: line.replace(/^\s*>\s?/, "") });
      continue;
    }
    if (!line.trim()) {
      blocks.push({ kind: "space", content: "" });
      continue;
    }
    blocks.push({ kind: "paragraph", content: line });
  }

  if (codeLines) blocks.push({ kind: "code", content: codeLines.join("\n") });
  return blocks;
}

export function MemoryDocument({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="memory-document">
      {blocks.map((block, index) => {
        const key = `${index}-${block.kind}-${block.content.slice(0, 16)}`;
        if (block.kind === "space") return <div className="memory-document__space" key={key} />;
        if (block.kind === "code") return <pre key={key}>{block.content}</pre>;
        if (block.kind === "quote") return <blockquote key={key}>{renderInline(block.content)}</blockquote>;
        if (block.kind === "bullet") {
          return (
            <p className="memory-document__bullet" key={key}>
              <span aria-hidden="true">–</span>
              <span>{renderInline(block.content)}</span>
            </p>
          );
        }
        if (block.kind === "heading") {
          const Heading = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
          return <Heading key={key}>{renderInline(block.content)}</Heading>;
        }
        return <p key={key}>{renderInline(block.content)}</p>;
      })}
    </div>
  );
}
