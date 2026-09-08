import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendOpenChatMessage } from "./chatSender";

describe("sendOpenChatMessage", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    storage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a visitor, sets the username, then sends the message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "visitor-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ displayName: "Froggy" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "message-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendOpenChatMessage({
      villageId: "village-1",
      roomId: "room-1",
      username: " Froggy ",
      content: " Hello village! ",
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ userId: "visitor-1", name: "Froggy", villageId: "village-1" }),
    });
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({
        villageId: "village-1",
        roomId: "room-1",
        content: "Hello village!",
        userSpeakerId: "visitor-1",
      }),
    });
  });

  it("rejects invalid fields before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendOpenChatMessage({
        villageId: "village-1",
        roomId: "room-1",
        username: "",
        content: "Hello",
      }),
    ).rejects.toThrow("Enter a username first.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

