import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalkMedia } from "@/components/safety/TalkMedia";

const { sign } = vi.hoisted(() => ({ sign: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ createSignedUrl: sign }) } } }));

const source = "https://bitogpfplcquovpdjprk.supabase.co/storage/v1/object/public/talk-media/test.png";
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); sign.mockReset(); });

describe("private media refresh", () => {
  it("re-signs after returning to a sleeping tab and retries a failed signing request", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://destination.example.test");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    sign.mockResolvedValueOnce({ data: null, error: new Error("offline") })
      .mockResolvedValueOnce({ data: { signedUrl: "https://destination.example.test/fresh" }, error: null });
    render(<TalkMedia value={source} kind="image" title="Synthetic media" />);
    await screen.findByText(/Media unavailable/);
    act(() => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(screen.getByAltText("Synthetic media")).toHaveAttribute("src", "https://destination.example.test/fresh"));
    expect(sign).toHaveBeenCalledWith("test.png", 600);
  });
  it("renews before expiration and stops renewal after unmount", async () => {
    vi.useFakeTimers();
    vi.stubEnv("VITE_SUPABASE_URL", "https://destination.example.test");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    sign.mockResolvedValue({ data: { signedUrl: "https://destination.example.test/fresh" }, error: null });
    const { unmount } = render(<TalkMedia value={source} kind="image" title="Synthetic media" />);
    await act(async () => { await Promise.resolve(); });
    expect(sign).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(8 * 60 * 1000); });
    expect(sign).toHaveBeenCalledTimes(2);
    unmount();
    await vi.advanceTimersByTimeAsync(8 * 60 * 1000);
    window.dispatchEvent(new Event("focus"));
    expect(sign).toHaveBeenCalledTimes(2);
  });
});
