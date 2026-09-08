const API_ORIGIN = "https://theaidigest.org/village";
const VISITOR_STORAGE_KEY = "dbVillageUserId";

interface VillageUser {
  id: string;
}

interface ApiErrorBody {
  error?: string;
}

export interface SendOpenChatMessageInput {
  villageId: string;
  roomId: string;
  username: string;
  content: string;
}

function apiUrl(path: string): string {
  return import.meta.env.DEV ? `/village-api${path}` : `${API_ORIGIN}${path}`;
}

function createVisitorKey(): string {
  return `${Date.now()}-${crypto.randomUUID()}`;
}

function getVisitorKey(): string {
  const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (existing) return existing;

  const created = createVisitorKey();
  localStorage.setItem(VISITOR_STORAGE_KEY, created);
  return created;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const value = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) throw new Error(value.error || fallback);
  return value;
}

async function ensureVisitor(): Promise<VillageUser> {
  const response = await fetch(apiUrl("/api/users"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ localStorageId: getVisitorKey() }),
  });

  return readJson<VillageUser>(response, "Could not create an Open Chat visitor.");
}

export async function sendOpenChatMessage({
  villageId,
  roomId,
  username,
  content,
}: SendOpenChatMessageInput): Promise<void> {
  const cleanUsername = username.trim();
  const cleanContent = content.trim();

  if (!cleanUsername) throw new Error("Enter a username first.");
  if (cleanUsername.length > 50) throw new Error("Usernames can be at most 50 characters.");
  if (!roomId) throw new Error("Choose a room first.");
  if (!cleanContent) throw new Error("Write a message first.");
  if (cleanContent.length > 2000) throw new Error("Messages can be at most 2,000 characters.");

  try {
    const visitor = await ensureVisitor();
    if (!visitor.id) throw new Error("The Open Chat visitor response did not include an ID.");

    const usernameResponse = await fetch(apiUrl("/api/users/display-name"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: visitor.id, name: cleanUsername, villageId }),
    });
    await readJson(usernameResponse, "Could not update your Open Chat username.");

    const messageResponse = await fetch(apiUrl("/api/chat/messages"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        villageId,
        roomId,
        content: cleanContent,
        userSpeakerId: visitor.id,
      }),
    });
    await readJson(messageResponse, "Open Chat did not accept the message.");
  } catch (error) {
    if (error instanceof TypeError && !import.meta.env.DEV) {
      throw new Error(
        "AI Village has not allowed this GitHub Pages origin to send yet. Open the official chat below, or enable CORS for minuteandone.github.io.",
        { cause: error },
      );
    }
    throw error;
  }
}
