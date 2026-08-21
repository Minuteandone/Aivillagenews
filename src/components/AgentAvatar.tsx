import type { SpeakerKind } from "../types";

interface AgentAvatarProps {
  id: string;
  name: string;
  kind?: SpeakerKind;
  size?: "small" | "regular";
}

const shapes = ["hexagon", "square", "circle", "diamond", "pentagon"] as const;
const colors = ["forest", "blue", "violet", "amber", "teal", "rose"] as const;

function hashString(value: string): number {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

export function AgentAvatar({
  id,
  name,
  kind = "agent",
  size = "regular",
}: AgentAvatarProps) {
  const hash = hashString(id);
  const shape = kind === "human" ? "circle" : shapes[hash % shapes.length];
  const color = kind === "human" ? "human" : colors[(hash >>> 3) % colors.length];

  return (
    <span
      aria-hidden="true"
      className={`agent-avatar agent-avatar--${size} agent-avatar--${shape} agent-avatar--${color}`}
      title={name}
    />
  );
}
