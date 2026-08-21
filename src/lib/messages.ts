import type {
  AgentOption,
  ApiAgent,
  ApiChatMessage,
  ApiChatRoom,
  ApiEvent,
  ChatMessage,
  RoomOption,
} from "../types";

const AGENT_TALK = "AGENT_TALK";
const USER_TALK = "USER_TALK";

function sortChronologically(messages: ChatMessage[]): ChatMessage[] {
  return messages.sort((a, b) => {
    const timeDifference =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

    if (timeDifference !== 0) return timeDifference;
    return (a.eventIndex ?? 0) - (b.eventIndex ?? 0);
  });
}

export function mapEventsToMessages(
  events: ApiEvent[],
  agents: ApiAgent[],
): ChatMessage[] {
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));

  const messages = events.flatMap<ChatMessage>((event) => {
    const { data } = event;
    const isAgent = data.actionType === AGENT_TALK;
    const isHuman = data.actionType === USER_TALK;

    if ((!isAgent && !isHuman) || !data.content || !data.roomId) return [];

    const speakerId = data.speakerId ?? `unknown-${event.id}`;
    const speakerName = isAgent
      ? (agentNames.get(speakerId) ?? "Unknown agent")
      : (data.speakerName ?? "Human visitor");

    return [
      {
        id: data.messageId ?? event.id,
        eventIndex: event.eventIndex ?? null,
        speakerId,
        speakerName,
        speakerKind: isAgent ? "agent" : "human",
        content: data.content,
        roomId: data.roomId,
        createdAt: event.createdAt,
      },
    ];
  });

  return sortChronologically(messages);
}

export function mapCurrentMessages(
  messages: ApiChatMessage[],
  agents: ApiAgent[],
): ChatMessage[] {
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));

  return sortChronologically(
    messages.map((message) => {
      const agentId = message.agentSpeakerId ?? null;
      const isAgent = Boolean(agentId) || message.speakerType === "agent";
      const speakerId = agentId ?? message.userSpeakerId ?? `unknown-${message.id}`;

      return {
        id: message.id,
        eventIndex: null,
        speakerId,
        speakerName: isAgent
          ? (agentNames.get(speakerId) ?? "Unknown agent")
          : "Human visitor",
        speakerKind: isAgent ? "agent" : "human",
        content: message.content,
        roomId: message.roomId,
        createdAt: message.createdAt,
      };
    }),
  );
}

export function buildRoomOptions(
  messages: ChatMessage[],
  rooms: ApiChatRoom[],
): RoomOption[] {
  const names = new Map(rooms.map((room) => [room.id, room.name]));
  const counts = new Map<string, number>();

  for (const message of messages) {
    counts.set(message.roomId, (counts.get(message.roomId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      count,
      name: names.get(id) ?? `room-${id.slice(0, 6)}`,
    }))
    .sort((a, b) => {
      if (a.name === "general") return -1;
      if (b.name === "general") return 1;
      return a.name.localeCompare(b.name);
    });
}

export function buildAgentOptions(
  messages: ChatMessage[],
  agents: ApiAgent[],
  selectedRoomId: string,
): AgentOption[] {
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  const counts = new Map<string, number>();

  for (const message of messages) {
    if (message.speakerKind !== "agent") continue;
    if (selectedRoomId !== "all" && message.roomId !== selectedRoomId) continue;
    counts.set(message.speakerId, (counts.get(message.speakerId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      count,
      name: agentNames.get(id) ?? "Unknown agent",
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function filterMessages(
  messages: ChatMessage[],
  roomId: string,
  agentId: string,
): ChatMessage[] {
  return messages.filter((message) => {
    const matchesRoom = roomId === "all" || message.roomId === roomId;
    const matchesAgent = agentId === "all" || message.speakerId === agentId;
    return matchesRoom && matchesAgent;
  });
}
