import type {
  ActivityEvent,
  ActivityKind,
  ApiAgent,
  ApiChatRoom,
  ApiEvent,
  ChatMessage,
  ContextChatMessage,
  HumanUseSession,
  HumanUseStatus,
  OutreachStatus,
  TimelineItem,
} from "../types";

const CHAT_ACTION_TYPES = new Set(["AGENT_TALK", "USER_TALK"]);
const FOLDED_ACTION_TYPES = new Set([
  "CANCEL_REQUEST_FOR_HUMAN_HELPER",
  "OUTREACH_APPROVAL_RESPONSE",
  "STOP_HUMAN_USE_SESSION",
]);
const COMPUTER_ACTION_PATTERN =
  /(COMPUTER|SCREENSHOT|MOUSE|KEYBOARD|BROWSER)_?(USE|TURN|ACTION|SESSION)?/i;

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

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
        summary: `${agentName} requested human use.`,
        detail: stringValue(data.shortDisplayedSessionGoal) ?? stringValue(data.sessionGoal),
      };
    case "OUTREACH_APPROVAL_REQUEST":
      return {
        summary: `${agentName} requested outreach approval.`,
        detail: stringValue(data.recipient),
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

function chronologicalEvents(events: ApiEvent[]): ApiEvent[] {
  return [...events].sort((a, b) => {
    const indexDifference = (a.eventIndex ?? 0) - (b.eventIndex ?? 0);
    if (indexDifference !== 0) return indexDifference;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function eventAgentId(event: ApiEvent): string {
  return (
    stringValue(event.data.agentId) ??
    stringValue(event.data.speakerId) ??
    `unknown-${event.id}`
  );
}

function eventRoomId(event: ApiEvent, roomIds: Map<string, string>): string | null {
  const roomName = stringValue(event.data.roomName);
  return stringValue(event.data.roomId) ?? (roomName ? (roomIds.get(roomName) ?? null) : null);
}

function humanStatusDetail(
  status: HumanUseStatus,
  session: HumanUseSession | undefined,
): string | null {
  if (status === "cancelled") return "The request was cancelled before it finished.";
  if (status === "active") {
    return session
      ? "A human helper session is currently active."
      : "Waiting for a human helper to accept the request.";
  }

  return (
    stringValue(session?.endComment) ??
    (session?.endReason === "user_timeout"
      ? "The helper session finished after timing out."
      : session?.endReason === "user_ended"
        ? "The human helper ended the session."
        : session?.endReason === "agent_ended"
          ? "The agent ended the helper session."
          : "The human helper session finished.")
  );
}

function humanChatMessages(
  session: HumanUseSession | undefined,
  requestEvent: ApiEvent,
  agentId: string,
  agentName: string,
  roomId: string | null,
): ContextChatMessage[] {
  if (!session) return [];

  const messages: ContextChatMessage[] = [];
  const helperId = session.userId ?? `human-helper-${session.id}`;
  const userIntro = stringValue(session.userIntro);

  if (userIntro) {
    messages.push({
      id: `${session.id}-intro`,
      eventIndex: requestEvent.eventIndex ?? null,
      agentId,
      speakerId: helperId,
      speakerName: "Human helper",
      speakerKind: "human",
      content: userIntro,
      roomId,
      createdAt: session.createdAt,
      contextKind: "human-helper",
      badge: "helper chat",
    });
  }

  for (const turn of session.turns ?? []) {
    const instructions = stringValue(turn.agentAction?.instructions);
    if (instructions) {
      messages.push({
        id: `${turn.id}-agent`,
        eventIndex: requestEvent.eventIndex ?? null,
        agentId,
        speakerId: agentId,
        speakerName: agentName,
        speakerKind: "agent",
        content: instructions,
        roomId,
        createdAt: turn.createdAt,
        contextKind: "human-helper",
        badge: "to helper",
      });
    }

    const userResponse = stringValue(turn.userResponse);
    if (userResponse) {
      messages.push({
        id: `${turn.id}-human`,
        eventIndex: requestEvent.eventIndex ?? null,
        agentId,
        speakerId: helperId,
        speakerName: "Human helper",
        speakerKind: "human",
        content: userResponse,
        roomId,
        createdAt: turn.updatedAt || turn.createdAt,
        contextKind: "human-helper",
        badge: "helper chat",
      });
    }
  }

  return messages.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function outreachChatMessages(
  requestEvent: ApiEvent,
  responseEvent: ApiEvent | undefined,
  agentId: string,
  agentName: string,
  roomId: string | null,
): ContextChatMessage[] {
  const messages: ContextChatMessage[] = [];
  const rationale = stringValue(requestEvent.data.rationale);

  if (rationale) {
    messages.push({
      id: `${requestEvent.id}-rationale`,
      eventIndex: requestEvent.eventIndex ?? null,
      agentId,
      speakerId: agentId,
      speakerName: agentName,
      speakerKind: "agent",
      content: rationale,
      roomId,
      createdAt: requestEvent.createdAt,
      contextKind: "outreach-reason",
      badge: "outreach reason",
    });
  }

  if (responseEvent && typeof responseEvent.data.approval === "boolean") {
    const approved = responseEvent.data.approval;
    const reviewReason = stringValue(responseEvent.data.adminComment);
    messages.push({
      id: `${responseEvent.id}-review`,
      eventIndex: responseEvent.eventIndex ?? null,
      agentId,
      speakerId: "outreach-reviewer",
      speakerName: "Outreach reviewer",
      speakerKind: "human",
      content: `${approved ? "Approved" : "Denied"}${reviewReason ? `: ${reviewReason}` : "."}`,
      roomId,
      createdAt: responseEvent.createdAt,
      contextKind: "outreach-reason",
      badge: approved ? "approval" : "denial",
    });
  }

  return messages;
}

function buildHumanStatuses(
  events: ApiEvent[],
  sessionsByRequest: Map<string, HumanUseSession>,
): Map<string, HumanUseStatus> {
  const statuses = new Map<string, HumanUseStatus>();
  const requestEventsByAgent = new Map<string, ApiEvent[]>();
  const requestEventsById = new Map<string, ApiEvent>();

  for (const event of events) {
    const actionType = event.data.actionType;
    const agentId = eventAgentId(event);

    if (actionType === "REQUEST_HUMAN_HELPER") {
      const requestId = stringValue(event.data.humanUseSessionRequestId);
      const session = requestId ? sessionsByRequest.get(requestId) : undefined;
      statuses.set(event.id, session?.hasEnded ? "finished" : "active");
      if (requestId) requestEventsById.set(requestId, event);
      const requests = requestEventsByAgent.get(agentId) ?? [];
      requests.push(event);
      requestEventsByAgent.set(agentId, requests);
      continue;
    }

    if (
      actionType !== "CANCEL_REQUEST_FOR_HUMAN_HELPER" &&
      actionType !== "STOP_HUMAN_USE_SESSION"
    ) {
      continue;
    }

    const explicitRequestId = stringValue(event.data.humanUseSessionRequestId);
    const explicitRequest = explicitRequestId ? requestEventsById.get(explicitRequestId) : undefined;
    const candidates = requestEventsByAgent.get(agentId) ?? [];
    const fallbackRequest = [...candidates]
      .reverse()
      .find((request) => statuses.get(request.id) === "active");
    const request = explicitRequest ?? fallbackRequest;
    if (!request) continue;

    statuses.set(
      request.id,
      actionType === "CANCEL_REQUEST_FOR_HUMAN_HELPER" ? "cancelled" : "finished",
    );
  }

  return statuses;
}

export function mapEventsToActivities(
  events: ApiEvent[],
  agents: ApiAgent[],
  rooms: ApiChatRoom[],
  humanUseSessions: HumanUseSession[] = [],
): ActivityEvent[] {
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.name]));
  const roomIds = new Map(rooms.map((room) => [room.name, room.id]));
  const sortedEvents = chronologicalEvents(events);
  const sessionsByRequest = new Map(
    humanUseSessions.map((session) => [session.requestId, session]),
  );
  const humanStatuses = buildHumanStatuses(sortedEvents, sessionsByRequest);
  const outreachResponses = new Map<string, ApiEvent>();

  for (const event of sortedEvents) {
    if (event.data.actionType !== "OUTREACH_APPROVAL_RESPONSE") continue;
    const requestId = stringValue(event.data.outreachApprovalRequestId);
    if (requestId) outreachResponses.set(requestId, event);
  }

  return sortedEvents.flatMap<ActivityEvent>((event) => {
    const actionType = event.data.actionType;
    if (
      !actionType ||
      CHAT_ACTION_TYPES.has(actionType) ||
      FOLDED_ACTION_TYPES.has(actionType) ||
      COMPUTER_ACTION_PATTERN.test(actionType)
    ) {
      return [];
    }

    const agentId = eventAgentId(event);
    const agentName = agentNames.get(agentId) ?? event.data.speakerName ?? "Unknown agent";
    const roomId = eventRoomId(event, roomIds);
    const copy = activityCopy(actionType, agentName, event.data);

    let status: HumanUseStatus | OutreachStatus | null = null;
    let request: string | null = null;
    let rationale: string | null = null;
    let reviewReason: string | null = null;
    let recipient: string | null = null;
    let medium: string | null = null;
    let humanConstraints: string | null = null;
    let estimatedDuration: number | null = null;
    let statusDetail: string | null = null;
    let chatMessages: ContextChatMessage[] = [];

    if (actionType === "REQUEST_HUMAN_HELPER") {
      const requestId = stringValue(event.data.humanUseSessionRequestId);
      const session = requestId ? sessionsByRequest.get(requestId) : undefined;
      status = humanStatuses.get(event.id) ?? (session?.hasEnded ? "finished" : "active");
      request =
        stringValue(event.data.sessionGoal) ??
        stringValue(session?.sessionGoal) ??
        stringValue(event.data.shortDisplayedSessionGoal) ??
        stringValue(session?.shortDisplayedSessionGoal);
      humanConstraints =
        stringValue(event.data.humanConstraints) ?? stringValue(session?.humanConstraints);
      estimatedDuration =
        typeof event.data.estimatedDuration === "number" ? event.data.estimatedDuration : null;
      statusDetail = humanStatusDetail(status, session);
      chatMessages = humanChatMessages(session, event, agentId, agentName, roomId);
    }

    if (actionType === "OUTREACH_APPROVAL_REQUEST") {
      const requestId = stringValue(event.data.outreachApprovalRequestId);
      const response = requestId ? outreachResponses.get(requestId) : undefined;
      status =
        typeof response?.data.approval === "boolean"
          ? response.data.approval
            ? "approved"
            : "denied"
          : "pending";
      request = stringValue(event.data.messageContent);
      rationale = stringValue(event.data.rationale);
      reviewReason = stringValue(response?.data.adminComment);
      recipient = stringValue(event.data.recipient) ?? stringValue(response?.data.recipient);
      medium = stringValue(event.data.medium) ?? stringValue(response?.data.medium);
      chatMessages = outreachChatMessages(event, response, agentId, agentName, roomId);
    }

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
        status,
        request,
        rationale,
        reviewReason,
        recipient,
        medium,
        humanConstraints,
        estimatedDuration,
        statusDetail,
        chatMessages,
      },
    ];
  });
}

interface TimelineVisibility {
  messages: boolean;
  pauses: boolean;
  consolidations: boolean;
  otherActions: boolean;
  humanHelperChat: boolean;
  outreachReasons: boolean;
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
    const matchesRoom = roomId === "all" || activity.roomId === roomId;
    const matchesAgent = agentId === "all" || activity.agentId === agentId;
    if (!matchesRoom || !matchesAgent) continue;

    const showActivity =
      (activity.kind === "pause" && visibility.pauses) ||
      (activity.kind === "consolidation" && visibility.consolidations) ||
      (activity.kind === "other" && visibility.otherActions);

    if (showActivity) {
      items.push({
        kind: "activity",
        activity,
        createdAt: activity.createdAt,
        eventIndex: activity.eventIndex,
      });
    }

    for (const message of activity.chatMessages) {
      const showContextMessage =
        (message.contextKind === "human-helper" && visibility.humanHelperChat) ||
        (message.contextKind === "outreach-reason" && visibility.outreachReasons);
      if (!showContextMessage) continue;

      items.push({
        kind: "context-message",
        message,
        createdAt: message.createdAt,
        eventIndex: message.eventIndex,
      });
    }
  }

  return items.sort((a, b) => {
    const timeDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (timeDifference !== 0) return timeDifference;
    return (a.eventIndex ?? 0) - (b.eventIndex ?? 0);
  });
}
