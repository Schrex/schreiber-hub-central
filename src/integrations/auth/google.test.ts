import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithGoogle } from "./google";

const mocks = vi.hoisted(() => ({ oauth: vi.fn(), broker: vi.fn(), setSession: vi.fn() }));
vi.mock("../supabase/client", () => ({
  supabase: { auth: { signInWithOAuth: mocks.oauth, setSession: mocks.setSession } },
}));
vi.mock("../lovable/index", () => ({ lovable: { auth: { signInWithOAuth: mocks.broker } } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_LOCAL_BACKEND", "false");
  vi.stubEnv("VITE_GOOGLE_AUTH_MODE", "");
  mocks.broker.mockResolvedValue({ redirected: true });
  mocks.oauth.mockResolvedValue({ data: { url: "https://accounts.example.test/oauth" }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

describe("Google authentication routing", () => {
  it("keeps the existing broker default and current-origin redirect", async () => {
    await signInWithGoogle();
    expect(mocks.broker).toHaveBeenCalledWith("google", { redirect_uri: window.location.origin });
    expect(mocks.oauth).not.toHaveBeenCalled();
  });

  it("opts into Supabase redirects without setting a broker session", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_MODE", "supabase");
    await signInWithGoogle();
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: "google", options: { redirectTo: window.location.origin },
    });
    expect(mocks.broker).not.toHaveBeenCalled();
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it.each(["supabase", "lovable"])("blocks %s in local synthetic mode", async mode => {
    vi.stubEnv("VITE_GOOGLE_AUTH_MODE", mode);
    vi.stubEnv("VITE_LOCAL_BACKEND", "true");
    await expect(signInWithGoogle()).rejects.toThrow("synthetic local environment");
    expect(mocks.oauth).not.toHaveBeenCalled();
    expect(mocks.broker).not.toHaveBeenCalled();
  });

  it("fails closed on a misspelled mode", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_MODE", "supabse");
    await expect(signInWithGoogle()).rejects.toThrow("Unknown Google authentication mode");
    expect(mocks.oauth).not.toHaveBeenCalled();
    expect(mocks.broker).not.toHaveBeenCalled();
  });

  it("propagates a Supabase error without falling back to Lovable", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_MODE", "supabase");
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: new Error("provider disabled") });
    await expect(signInWithGoogle()).rejects.toThrow("provider disabled");
    expect(mocks.broker).not.toHaveBeenCalled();
  });

  it("rejects a missing redirect instead of reporting successful login", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_MODE", "supabase");
    mocks.oauth.mockResolvedValue({ data: { url: null }, error: null });
    await expect(signInWithGoogle()).rejects.toThrow("redirect URL");
  });

  it("propagates broker errors and lets the broker own its session handling", async () => {
    mocks.broker.mockResolvedValue({ error: new Error("broker rejected") });
    await expect(signInWithGoogle()).rejects.toThrow("broker rejected");
    expect(mocks.setSession).not.toHaveBeenCalled();
  });

  it("propagates thrown network failures", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_MODE", "supabase");
    mocks.oauth.mockRejectedValue(new Error("network unavailable"));
    await expect(signInWithGoogle()).rejects.toThrow("network unavailable");
  });
});
