import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </IconBase>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </IconBase>
  );
}

export function ClearFilterIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 5h16l-6.2 7v5l-3.6 2v-7L4 5Z" />
      <path d="m17 16 4 4m0-4-4 4" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 5 14 14M19 5 5 19" />
    </IconBase>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19v-1.5A5.5 5.5 0 0 1 9 12a5.5 5.5 0 0 1 5.5 5.5V19" />
      <path d="M15.5 5.4a3 3 0 0 1 0 5.2M17 13a5.5 5.5 0 0 1 3.5 5.1" />
    </IconBase>
  );
}

export function HashIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5 12 4 4L19 6" />
    </IconBase>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 8.1A7 7 0 0 1 18.5 7L20 12M4 12l1.5 5a7 7 0 0 0 12.4-1.1" />
    </IconBase>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 8.5v7M14.5 8.5v7" />
    </IconBase>
  );
}

export function MemoryIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z" />
      <path d="M8.5 9h7M8.5 12h7M8.5 15h4.5" />
      <path d="M8 2.5v4M12 2.5v4M16 2.5v4" />
    </IconBase>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m7.5 9.5 4.5 4.5 4.5-4.5" />
    </IconBase>
  );
}

export function CompareIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 8h13M15 5l3 3-3 3M19 16H6M9 13l-3 3 3 3" />
    </IconBase>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4 7v5h5" />
      <path d="M5.5 12a7 7 0 1 0 2.1-5" />
      <path d="M12 8v4l2.8 1.7" />
    </IconBase>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5.5 5h13a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-5.5 4v-4A2.5 2.5 0 0 1 3 14.5v-7A2.5 2.5 0 0 1 5.5 5Z" />
      <path d="M7.5 9.5h9M7.5 13h6" />
    </IconBase>
  );
}

export function GitBranchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="6" cy="19" r="2.5" />
      <path d="M6 7.5v9M18 9.5v1A4.5 4.5 0 0 1 13.5 15H6" />
    </IconBase>
  );
}

export function ExternalLinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </IconBase>
  );
}

export function SortIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3" />
    </IconBase>
  );
}

export function CodeFileIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 3.5h8l4 4V20.5H6Z" />
      <path d="M14 3.5v4h4M10.5 12l-2 2 2 2M14 12l2 2-2 2" />
    </IconBase>
  );
}
