export type SpeakerKind = "agent" | "human";

export interface ApiVillageSummary {
  id: string;
  slug: string;
  name: string;
  villageGoal?: string | null;
  error?: string;
}

export interface ApiAgent {
  id: string;
  name: string;
  emoji?: string | null;
  modelString?: string | null;
}

export interface ApiChatRoom {
  id: string;
  name: string;
  deletedAt?: string | null;
}

export interface ApiChatMessage {
  id: string;
  agentSpeakerId?: string | null;
  userSpeakerId?: string | null;
  speakerType?: string | null;
  content: string;
  roomId: string;
  createdAt: string;
}

export interface ApiVillage extends ApiVillageSummary {
  agents: ApiAgent[];
  chatRooms: ApiChatRoom[];
  chatMessages: ApiChatMessage[];
  users?: Array<{ id: string; name?: string | null; displayName?: string | null }>;
}

export interface ApiEventData {
  actionType?: string;
  agentId?: string;
  answerToQuery?: string;
  approval?: boolean;
  content?: string;
  currentRooms?: string;
  endDate?: string;
  estimatedDuration?: number;
  humanConstraints?: string;
  medium?: string;
  messageId?: string;
  messageContent?: string;
  nextSessionGoal?: string;
  nextShortDisplayedSessionGoal?: string;
  previousRoomId?: string;
  previousRoomName?: string;
  query?: string;
  rationale?: string;
  recipient?: string;
  roomId?: string;
  roomName?: string;
  seconds?: number;
  sessionGoal?: string;
  shortDisplayedSessionGoal?: string;
  speakerId?: string;
  speakerName?: string;
  speakerType?: string;
  startDate?: string;
  [key: string]: unknown;
}

export interface ApiEvent {
  id: string;
  eventIndex?: number;
  data: ApiEventData;
  createdAt: string;
}

export interface ApiEventsResponse {
  events?: ApiEvent[];
  error?: string;
  hasMore?: boolean;
  windowDate?: string;
}

export interface ChatMessage {
  id: string;
  eventIndex: number | null;
  speakerId: string;
  speakerName: string;
  speakerKind: SpeakerKind;
  content: string;
  roomId: string;
  createdAt: string;
}

export type ActivityKind = "pause" | "consolidation" | "other";

export interface ActivityEvent {
  id: string;
  eventIndex: number | null;
  actionType: string;
  kind: ActivityKind;
  agentId: string;
  agentName: string;
  roomId: string | null;
  createdAt: string;
  summary: string;
  detail: string | null;
  seconds: number | null;
  nextSessionGoal: string | null;
}

export interface MemoryVersion {
  id: string;
  agentId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMemoriesResponse {
  memories?: MemoryVersion[];
  error?: string;
}

export interface MemoryPair {
  current: MemoryVersion;
  previous: MemoryVersion | null;
}

export type TimelineItem =
  | { kind: "message"; message: ChatMessage; createdAt: string; eventIndex: number | null }
  | { kind: "activity"; activity: ActivityEvent; createdAt: string; eventIndex: number | null };

export interface VillageData {
  id: string;
  slug: string;
  name: string;
  agents: ApiAgent[];
  rooms: ApiChatRoom[];
  dates: string[];
  latestDate: string;
  latestMessages: ChatMessage[];
}

export interface RoomOption {
  id: string;
  name: string;
  count: number;
}

export interface AgentOption {
  id: string;
  name: string;
  count: number;
}
