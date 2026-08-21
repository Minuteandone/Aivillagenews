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
