import type {
  ActivityEvent,
  ActivityKind,
  ApiAgent,
  ApiChatRoom,
  ApiEvent,
  ChatMessage,
  TimelineItem,
} from "../types";

const CHAT_ACTION_TYPES = new Set(["AGENT_TALK", "USER_TALK"]);
const COMPUTER_ACTION_PATTERN = /(COMPUTER|SCREENSHOT|MOUSE|KEYBOARD|BROWSER)_?(USE|TURN|ACTION|SESSION)?/i;

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} ${seconds === 1 ? "second" : "seconds"}`;
  if (seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function readableActionType(actionType: string): string {
  return actionType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function activityCopy(
  actionType: string,
  agentName: string,
  data: ApiEvent["data"],
): { summary: string; detail: string | null } {
  switch (actionType) {
    case "PAUSE": {
      const seconds = typeof data.seconds === "number" ? data.seconds : 0;
      return {
        summary: `${agentName} paused${seconds > 0 ? ` for ${formatDuration(seconds)}` : ""}.`,
        detail: null,
      };
    }
    case "CONSOLIDATE":
      return {
        summary: "Consolidated memory",
        detail:
          typeof data.nextSessionGoal === "string"
            ? `Next: ${data.nextSessionGoal}`
            : typeof data.nextShortDisplayedSessionGoal === "string"
              ? `Next: ${data.nextShortDisplayedSessionGoal}`
              : null,
      };
    case "ENTER_ROOM": {
      const destination = typeof data.roomName === "string" ? `#${data.roomName}` : "another room";
      const source =
        typeof data.previousRoomName === "string" ? ` from #${data.previousRoomName}` : "";
      return { summary: `${agentName} moved${source} to ${destination}.`, detail: null };
    }
    case "SEARCH_HISTORY":
      return {
        summary: `${agentName} searched village history.`,
        detail: typeof data.query === "string" ? data.query : null,
      };
    case "REQUEST_HUMAN_HELPER":
      return {
        summary: `${agentName} requested a human helper.`,
        detail:
          typeof data.sessionGoal === "string"
            ? data.sessionGoal
            : typeof data.shortDisplayedSessionGoal === "string"
              ? data.shortDisplayedSessionGoal
              : null,
      };
    case "CANCEL_REQUEST_FOR_HUMAN_HELPER":
      return { summary: `${agentName} canceled a human-helper request.`, detail: null };
    case "OUTREACH_APPROVAL_REQUEST":
      return {
        summary: `${agentName} requested outreach approval.`,
        detail:
          typeof data.recipient === "string"
            ? `${typeof data.medium === "string" ? `${data.medium} · ` : ""}${data.recipient}`
            : typeof data.medium === "string"
              ? data.medium
              : null,
      };
    case "OUTREACH_APPROVAL_RESPONSE":
      return {
        summary: `${agentName}'s outreach was ${data.approval ? "approved" : "declined"}.`,
        detail: typeof data.recipient === "string" ? data.recipient : null,
      };
    case "REQUEST_GOOGLE_SIGN_IN":
      return { summary: `${agentName} requested Google sign-in.`, detail: null };
    case "RESTARTING_AFTER_GOOGLE_SIGN_IN":
      return { summary: `${agentName} resumed after Google sign-in.`, detail: null };
    default:
      return {
        summary: `${agentName}: ${readableActionType(actionType)}`,
        detail: null,
      };
  }
}

function activityKind(actionType: string): ActivityKind {
  if (actionType === "PAUSE") return "pause";
  if (actionType === "CONSOLIDATE") return "consolidation";
  return "other";
}

export function mapEventsToActivities(
  events: ApiEvent[],
  agents: ApiAgent[],
  rooms: ApiChatRoom[],
): ActivityEvent[] {
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  const roomIds = new Map(rooms.map((room) => [room.name, room.id]));

  return events.flatMap<ActivityEvent>((event) => {
    const actionType = event.data.actionType;
    if (!actionType || CHAT_ACTION_TYPES.has(actionType) || COMPUTER_ACTION_PATTERN.test(actionType)) {
      return [];
    }

    const agentId =
      typeof event.data.agentId === "string"
        ? event.data.agentId
        : typeof event.data.speakerId === "string"
          ? event.data.speakerId
          : `unknown-${event.id}`;
    const agentName = agentNames.get(agentId) ?? event.data.speakerName ?? "Unknown agent";
    const roomId =
      typeof event.data.roomId === "string"
        ? event.data.roomId
        : typeof event.data.roomName === "string"
          ? (roomIds.get(event.data.roomName) ?? null)
          : null;
    const copy = activityCopy(actionType, agentName, event.data);

    return [
      {
        id: event.id,
        eventIndex: event.eventIndex ?? null,
        actionType,
        kind: activityKind(actionType),
        agentId,
        agentName,
        roomId,
        createdAt: event.createdAt,
        summary: copy.summary,
        detail: copy.detail,
        seconds: typeof event.data.seconds === "number" ? event.data.seconds : null,
        nextSessionGoal:
          typeof event.data.nextSessionGoal === "string" ? event.data.nextSessionGoal : null,
      },
    ];
  });
}

interface TimelineVisibility {
  messages: boolean;
  pauses: boolean;
  consolidations: boolean;
  otherActions: boolean;
}

export function buildTimelineItems(
  messages: ChatMessage[],
  activities: ActivityEvent[],
  visibility: TimelineVisibility,
  roomId: string,
  agentId: string,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  if (visibility.messages) {
    for (const message of messages) {
      const matchesRoom = roomId === "all" || message.roomId === roomId;
      const matchesAgent = agentId === "all" || message.speakerId === agentId;
      if (!matchesRoom || !matchesAgent) continue;
      items.push({
        kind: "message",
        message,
        createdAt: message.createdAt,
        eventIndex: message.eventIndex,
      });
    }
  }

  for (const activity of activities) {
    if (activity.kind === "pause" && !visibility.pauses) continue;
    if (activity.kind === "consolidation" && !visibility.consolidations) continue;
    if (activity.kind === "other" && !visibility.otherActions) continue;

    const matchesRoom = roomId === "all" || activity.roomId === roomId;
    const matchesAgent = agentId === "all" || activity.agentId === agentId;
    if (!matchesRoom || !matchesAgent) continue;

    items.push({
      kind: "activity",
      activity,
      createdAt: activity.createdAt,
      eventIndex: activity.eventIndex,
    });
  }

  return items.sort((a, b) => {
    const timeDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDifference !== 0) return timeDifference;
    return (a.eventIndex ?? 0) - (b.eventIndex ?? 0);
  });
}

