import { AgentPageIcon, ChatIcon, GitBranchIcon } from "./Icons";

export type ArchiveView = "timeline" | "git" | "agents";

interface ViewSwitcherProps {
  value: ArchiveView;
  onChange: (view: ArchiveView) => void;
  disabled?: boolean;
}

export function ViewSwitcher({ value, onChange, disabled = false }: ViewSwitcherProps) {
  return (
    <div className="view-switcher" aria-label="Archive view">
      <button
        type="button"
        aria-pressed={value === "timeline"}
        onClick={() => onChange("timeline")}
        disabled={disabled}
      >
        <ChatIcon />
        Chat &amp; context
      </button>
      <button
        type="button"
        aria-pressed={value === "git"}
        onClick={() => onChange("git")}
        disabled={disabled}
      >
        <GitBranchIcon />
        Git history
      </button>
      <button
        type="button"
        aria-pressed={value === "agents"}
        onClick={() => onChange("agents")}
        disabled={disabled}
      >
        <AgentPageIcon />
        Agent pages
      </button>
    </div>
  );
}
