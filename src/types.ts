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
  adminComment?: string;
  agentId?: string;
  answerToQuery?: string;
  approval?: boolean;
  content?: string;
  currentRooms?: string;
  endDate?: string;
  estimatedDuration?: number;
  humanConstraints?: string;
  humanUseSessionRequestId?: string;
  medium?: string;
  messageId?: string;
  messageContent?: string;
  nextSessionGoal?: string;
  nextShortDisplayedSessionGoal?: string;
  outreachApprovalRequestId?: string;
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

export interface HumanUseAgentAction {
  action?: string;
  content?: string;
  estimatedDuration?: number;
  instructions?: string;
  [key: string]: unknown;
}

export interface HumanUseTurn {
  id: string;
  sessionId: string;
  agentAction?: HumanUseAgentAction | null;
  userResponseStatus?: string | null;
  userResponseOutcome?: string | null;
  userResponse?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HumanUseSession {
  id: string;
  requestId: string;
  userId?: string | null;
  userIntro?: string | null;
  hasEnded: boolean;
  endReason?: string | null;
  endComment?: string | null;
  createdAt: string;
  updatedAt: string;
  agentId: string;
  sessionGoal?: string | null;
  shortDisplayedSessionGoal?: string | null;
  humanConstraints?: string | null;
  turns: HumanUseTurn[];
}

export interface ApiHumanUseSessionsResponse {
  sessions?: HumanUseSession[];
  windowDate?: string;
  error?: string;
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

export type HumanUseStatus = "active" | "finished" | "cancelled";
export type OutreachStatus = "pending" | "approved" | "denied";
export type ContextMessageKind = "human-helper" | "outreach-reason";

export interface ContextChatMessage {
  id: string;
  eventIndex: number | null;
  agentId: string;
  speakerId: string;
  speakerName: string;
  speakerKind: SpeakerKind;
  content: string;
  roomId: string | null;
  createdAt: string;
  contextKind: ContextMessageKind;
  badge: string;
}

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
  status: HumanUseStatus | OutreachStatus | null;
  request: string | null;
  rationale: string | null;
  reviewReason: string | null;
  recipient: string | null;
  medium: string | null;
  humanConstraints: string | null;
  estimatedDuration: number | null;
  statusDetail: string | null;
  chatMessages: ContextChatMessage[];
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
  | { kind: "activity"; activity: ActivityEvent; createdAt: string; eventIndex: number | null }
  | {
      kind: "context-message";
      message: ContextChatMessage;
      createdAt: string;
      eventIndex: number | null;
    };

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

export type GitPlatform = "github" | "gitlab";

export interface GitCommit {
  id: string;
  platform: GitPlatform;
  sha: string;
  shortSha: string;
  projectId: string;
  projectPath: string;
  projectName: string;
  title: string;
  message: string;
  authorName: string;
  authorUsername: string | null;
  authorEmail: string | null;
  avatarUrl: string | null;
  authoredAt: string;
  committedAt: string;
  webUrl: string;
  parentShas: string[];
  refName: string | null;
}

export type GitFileChangeType =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "unknown";

export interface GitCommitFile {
  id: string;
  path: string;
  previousPath: string | null;
  changeType: GitFileChangeType;
  additions: number | null;
  deletions: number | null;
  changes: number | null;
  patch: string | null;
  patchTruncated: boolean;
  webUrl: string | null;
}

export interface GitCommitDetail {
  additions: number | null;
  deletions: number | null;
  changes: number | null;
  files: GitCommitFile[];
  filesTruncated: boolean;
  verified: boolean | null;
  verificationReason: string | null;
}

export interface GitHistorySourceResult {
  platform: GitPlatform;
  status: "loaded" | "partial" | "error";
  count: number;
  detail: string;
}

export interface GitHistoryResult {
  commits: GitCommit[];
  sources: GitHistorySourceResult[];
  warnings: string[];
  githubTotalCount: number;
  scannedGitLabProjects: number;
  totalGitLabCandidateProjects: number;
}

export interface GitProjectOption {
  id: string;
  platform: GitPlatform;
  name: string;
  path: string;
  count: number;
}

export interface GitAuthorOption {
  id: string;
  name: string;
  count: number;
}
