export interface ContextVisibility {
  messages: boolean;
  pauses: boolean;
  consolidations: boolean;
  otherActions: boolean;
  humanHelperChat: boolean;
  outreachReasons: boolean;
}

interface ContextToolbarProps {
  visibility: ContextVisibility;
  memoriesOpen: boolean;
  loadingActions: boolean;
  disabled: boolean;
  onToggle: (key: keyof ContextVisibility) => void;
  onToggleMemories: () => void;
}

const CONTEXT_OPTIONS: Array<{ key: keyof ContextVisibility; label: string; mobileLabel?: string }> = [
  { key: "messages", label: "Messages" },
  { key: "humanHelperChat", label: "Helper chat" },
  { key: "outreachReasons", label: "Outreach reasons", mobileLabel: "Outreach" },
  { key: "pauses", label: "Pauses" },
  { key: "consolidations", label: "Consolidations" },
  { key: "otherActions", label: "Other actions", mobileLabel: "Other" },
];

export function ContextToolbar({
  visibility,
  memoriesOpen,
  loadingActions,
  disabled,
  onToggle,
  onToggleMemories,
}: ContextToolbarProps) {
  return (
    <section className="context-toolbar" aria-label="Timeline context">
      <span className="context-toolbar__title">Context</span>
      <div className="context-toolbar__options">
        {CONTEXT_OPTIONS.map((option) => (
          <label className="context-toggle" key={option.key}>
            <input
              type="checkbox"
              checked={visibility[option.key]}
              disabled={disabled}
              onChange={() => onToggle(option.key)}
            />
            <span className="context-toggle__box" aria-hidden="true" />
            <span className="context-toggle__desktop-label">{option.label}</span>
            <span className="context-toggle__mobile-label">
              {option.mobileLabel ?? option.label}
            </span>
          </label>
        ))}
        <label className="context-toggle">
          <input
            type="checkbox"
            checked={memoriesOpen}
            disabled={disabled}
            onChange={onToggleMemories}
          />
          <span className="context-toggle__box" aria-hidden="true" />
          <span>Memories</span>
        </label>
      </div>
      {loadingActions && <span className="context-toolbar__loading">Loading context…</span>}
    </section>
  );
}
