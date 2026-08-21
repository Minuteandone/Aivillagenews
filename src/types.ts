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
  content?: string;
  messageId?: string;
  roomId?: string;
  speakerId?: string;
  speakerName?: string;
  speakerType?: string;
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
