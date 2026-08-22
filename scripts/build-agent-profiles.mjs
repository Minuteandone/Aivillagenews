import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const API_ORIGIN = "https://theaidigest.org/village";
const DEFAULT_SLUG = "actual-launch-1";
const DEFAULT_OUTPUT = "public/data/agent-profiles.json";
const CONCURRENCY = 12;
const MAX_ATTEMPTS = 4;

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function timestamp(value) {
  return new Date(value).getTime();
}

function chronological(a, b) {
  const timeDifference = timestamp(a.createdAt) - timestamp(b.createdAt);
  if (timeDifference !== 0) return timeDifference;
  return (a.eventIndex ?? 0) - (b.eventIndex ?? 0);
}

async function fetchJson(path, attempt = 1) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    headers: { Accept: "application/json", "User-Agent": "VillageArchiveProfileIndexer/1.0" },
  });

  if (response.ok) return response.json();
  if (attempt >= MAX_ATTEMPTS || (response.status < 500 && response.status !== 429)) {
    throw new Error(`${path} returned ${response.status}.`);
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 750 * 2 ** (attempt - 1)));
  return fetchJson(path, attempt + 1);
}

async function mapConcurrent(values, limit, mapper) {
  const results = new Array(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => worker()));
  return results;
}

async function loadExisting(outputPath) {
  try {
    return JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function emptyProfile(agentId) {
  return {
    agentId,
    firstMessage: null,
    lastMessage: null,
    humanHelperRequests: [],
  };
}

function eventMessage(event, agentNames) {
  const speakerId = stringValue(event.data?.speakerId);
  const roomId = stringValue(event.data?.roomId);
  const content = stringValue(event.data?.content);
  if (!speakerId || !roomId || !content) return null;

  return {
    id: stringValue(event.data?.messageId) ?? event.id,
    eventIndex: event.eventIndex ?? null,
    speakerId,
    speakerName: agentNames.get(speakerId) ?? "Unknown agent",
    speakerKind: "agent",
    content,
    roomId,
    createdAt: event.createdAt,
  };
}

function statusDetail(status, session) {
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

function helperChat(session, request) {
  if (!session) return [];

  const messages = [];
  const helperId = session.userId ?? `human-helper-${session.id}`;
  const intro = stringValue(session.userIntro);

  if (intro) {
    messages.push({
      id: `${session.id}-intro`,
      eventIndex: request.eventIndex,
      agentId: request.agentId,
      speakerId: helperId,
      speakerName: "Human helper",
      speakerKind: "human",
      content: intro,
      roomId: request.roomId,
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
        eventIndex: request.eventIndex,
        agentId: request.agentId,
        speakerId: request.agentId,
        speakerName: request.agentName,
        speakerKind: "agent",
        content: instructions,
        roomId: request.roomId,
        createdAt: turn.createdAt,
        contextKind: "human-helper",
        badge: "to helper",
      });
    }

    const response = stringValue(turn.userResponse);
    if (response) {
      messages.push({
        id: `${turn.id}-human`,
        eventIndex: request.eventIndex,
        agentId: request.agentId,
        speakerId: helperId,
        speakerName: "Human helper",
        speakerKind: "human",
        content: response,
        roomId: request.roomId,
        createdAt: turn.updatedAt || turn.createdAt,
        contextKind: "human-helper",
        badge: "helper chat",
      });
    }
  }

  return messages.sort(chronological);
}

function requestFromEvent(event, agentNames) {
  const agentId = stringValue(event.data?.agentId) ?? `unknown-${event.id}`;
  const requestId = stringValue(event.data?.humanUseSessionRequestId);
  const agentName = agentNames.get(agentId) ?? "Unknown agent";

  return {
    id: event.id,
    requestId,
    eventIndex: event.eventIndex ?? null,
    actionType: "REQUEST_HUMAN_HELPER",
    kind: "other",
    agentId,
    agentName,
    roomId: stringValue(event.data?.roomId),
    createdAt: event.createdAt,
    summary: `${agentName} requested human use.`,
    detail:
      stringValue(event.data?.shortDisplayedSessionGoal) ??
      stringValue(event.data?.sessionGoal),
    seconds: null,
    nextSessionGoal: null,
    status: "active",
    request:
      stringValue(event.data?.sessionGoal) ??
      stringValue(event.data?.shortDisplayedSessionGoal),
    rationale: null,
    reviewReason: null,
    recipient: null,
    medium: null,
    humanConstraints: stringValue(event.data?.humanConstraints),
    estimatedDuration:
      typeof event.data?.estimatedDuration === "number" ? event.data.estimatedDuration : null,
    statusDetail: "Waiting for a human helper to accept the request.",
    chatMessages: [],
  };
}

function mergeSession(request, session) {
  if (!session) return request;
  const status = session.hasEnded ? "finished" : "active";
  return {
    ...request,
    request:
      request.request ??
      stringValue(session.sessionGoal) ??
      stringValue(session.shortDisplayedSessionGoal),
    humanConstraints: request.humanConstraints ?? stringValue(session.humanConstraints),
    status,
    statusDetail: statusDetail(status, session),
    chatMessages: helperChat(session, request),
  };
}

function findFallbackRequest(profiles, agentId) {
  return Object.values(profiles)
    .flatMap((profile) => profile.humanHelperRequests)
    .filter((request) => request.agentId === agentId && request.status === "active")
    .sort(chronological)
    .at(-1);
}

function processEvent(event, profiles, agentNames, helperDates) {
  const actionType = event.data?.actionType;

  if (actionType === "AGENT_TALK") {
    const message = eventMessage(event, agentNames);
    if (!message) return;
    const profile = profiles[message.speakerId] ?? emptyProfile(message.speakerId);
    if (!profile.firstMessage || chronological(message, profile.firstMessage) < 0) {
      profile.firstMessage = message;
    }
    if (!profile.lastMessage || chronological(message, profile.lastMessage) > 0) {
      profile.lastMessage = message;
    }
    profiles[message.speakerId] = profile;
    return;
  }

  if (actionType === "REQUEST_HUMAN_HELPER") {
    const request = requestFromEvent(event, agentNames);
    const profile = profiles[request.agentId] ?? emptyProfile(request.agentId);
    const existingIndex = profile.humanHelperRequests.findIndex((item) => item.id === request.id);
    if (existingIndex >= 0) profile.humanHelperRequests[existingIndex] = request;
    else profile.humanHelperRequests.push(request);
    profiles[request.agentId] = profile;
    helperDates.add(event.createdAt.slice(0, 10));
    return;
  }

  if (
    actionType !== "CANCEL_REQUEST_FOR_HUMAN_HELPER" &&
    actionType !== "STOP_HUMAN_USE_SESSION"
  ) {
    return;
  }

  const agentId = stringValue(event.data?.agentId) ?? `unknown-${event.id}`;
  const requestId = stringValue(event.data?.humanUseSessionRequestId);
  const explicit = requestId
    ? Object.values(profiles)
        .flatMap((profile) => profile.humanHelperRequests)
        .find((request) => request.requestId === requestId)
    : null;
  const request = explicit ?? findFallbackRequest(profiles, agentId);
  if (!request) return;
  request.status = actionType === "CANCEL_REQUEST_FOR_HUMAN_HELPER" ? "cancelled" : "finished";
  request.statusDetail = statusDetail(request.status);
  helperDates.add(event.createdAt.slice(0, 10));
}

function sanitizeProfiles(profiles, knownAgentIds) {
  return Object.fromEntries(
    Object.entries(profiles)
      .filter(([agentId]) => knownAgentIds.has(agentId))
      .map(([agentId, profile]) => [
        agentId,
        {
          ...profile,
          humanHelperRequests: [...profile.humanHelperRequests]
            .sort(chronological)
            .reverse(),
        },
      ]),
  );
}

async function main() {
  const slug = process.argv[2] ?? DEFAULT_SLUG;
  const outputPath = resolve(process.argv[3] ?? DEFAULT_OUTPUT);
  const summary = await fetchJson(`/api/villages?slug=${encodeURIComponent(slug)}`);
  if (!summary.id) throw new Error(summary.error ?? `Village ${slug} was not found.`);

  const [village, activeDates] = await Promise.all([
    fetchJson(`/api/villages/${encodeURIComponent(summary.id)}`),
    fetchJson(`/api/villages/${encodeURIComponent(summary.id)}/active-dates`),
  ]);
  const dates = [...(activeDates.dates ?? [])].sort();
  const latestDate = dates.at(-1);
  if (!latestDate) throw new Error(`Village ${slug} has no active dates.`);

  const existing = await loadExisting(outputPath);
  const canIncrement =
    existing?.version === 1 &&
    existing.villageId === village.id &&
    existing.profiles &&
    typeof existing.indexedThroughDate === "string";
  const profiles = canIncrement ? structuredClone(existing.profiles) : {};
  const startAfter = canIncrement ? existing.indexedThroughDate : null;
  const datesToFetch = dates.filter((date) => !startAfter || date > startAfter || date === latestDate);
  const agentNames = new Map((village.agents ?? []).map((agent) => [agent.id, agent.name]));
  const helperDates = new Set();

  for (const agent of village.agents ?? []) {
    profiles[agent.id] ??= emptyProfile(agent.id);
  }

  console.log(
    `${canIncrement ? "Refreshing" : "Building"} ${slug}: ${datesToFetch.length} event day${datesToFetch.length === 1 ? "" : "s"}.`,
  );

  const eventDays = await mapConcurrent(datesToFetch, CONCURRENCY, async (date, index) => {
    const response = await fetchJson(
      `/api/events?villageId=${encodeURIComponent(village.id)}&date=${encodeURIComponent(date)}&page=1`,
    );
    if ((index + 1) % 20 === 0 || index + 1 === datesToFetch.length) {
      console.log(`Fetched ${index + 1}/${datesToFetch.length} event days.`);
    }
    return { date, events: response.events ?? [] };
  });

  for (const { events } of eventDays.sort((a, b) => a.date.localeCompare(b.date))) {
    for (const event of [...events].sort(chronological)) {
      processEvent(event, profiles, agentNames, helperDates);
    }
  }

  helperDates.add(latestDate);

  const sessionDays = await mapConcurrent([...helperDates].sort(), 6, async (date) => {
    const response = await fetchJson(
      `/api/human-use-sessions?villageId=${encodeURIComponent(village.id)}&date=${encodeURIComponent(date)}`,
    );
    return response.sessions ?? [];
  });
  const sessionsByRequest = new Map(
    sessionDays.flat().map((session) => [session.requestId, session]),
  );

  for (const profile of Object.values(profiles)) {
    profile.humanHelperRequests = profile.humanHelperRequests.map((request) =>
      mergeSession(request, request.requestId ? sessionsByRequest.get(request.requestId) : null),
    );
  }

  const knownAgentIds = new Set((village.agents ?? []).map((agent) => agent.id));
  const output = {
    version: 1,
    villageId: village.id,
    villageSlug: village.slug,
    generatedAt: new Date().toISOString(),
    indexedThroughDate: latestDate,
    profiles: sanitizeProfiles(profiles, knownAgentIds),
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  const requestCount = Object.values(output.profiles).reduce(
    (count, profile) => count + profile.humanHelperRequests.length,
    0,
  );
  console.log(
    `Wrote ${Object.keys(output.profiles).length} profiles and ${requestCount} helper requests through ${latestDate} to ${outputPath}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
