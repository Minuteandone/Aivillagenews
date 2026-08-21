import { useEffect, useRef } from "react";
import { CloseIcon } from "./Icons";
import { FiltersPanel } from "./FiltersPanel";
import type { ComponentProps } from "react";

type FiltersPanelProps = ComponentProps<typeof FiltersPanel>;

interface MobileFilterDrawerProps extends Omit<FiltersPanelProps, "mobile"> {
  open: boolean;
  onClose: () => void;
}

export function MobileFilterDrawer({ open, onClose, ...filterProps }: MobileFilterDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="mobile-drawer-layer">
      <button
        className="mobile-drawer-backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close filters"
      />
      <aside className="mobile-drawer" role="dialog" aria-modal="true" aria-label="Filters">
        <div className="mobile-drawer__handle" aria-hidden="true" />
        <button
          ref={closeButtonRef}
          className="icon-button mobile-drawer__close"
          type="button"
          onClick={onClose}
          aria-label="Close filters"
        >
          <CloseIcon />
        </button>
        <FiltersPanel mobile {...filterProps} />
        <button className="primary-button mobile-apply" type="button" onClick={onClose}>
          Apply filters
        </button>
      </aside>
    </div>
  );
}
