import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useResumeRefresh } from "@/hooks/useResumeRefresh";

afterEach(() => vi.restoreAllMocks());

describe("resume refresh without Realtime", () => {
  it("refreshes on visible return and restored connectivity, then removes listeners", () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useResumeRefresh(refresh));
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(refresh).toHaveBeenCalledTimes(3);
    unmount();
    window.dispatchEvent(new Event("focus"));
    expect(refresh).toHaveBeenCalledTimes(3);
  });
  it("does not fetch while hidden and uses the latest session callback after rerender", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(({ refresh }) => useResumeRefresh(refresh), { initialProps: { refresh: first } });
    window.dispatchEvent(new Event("online"));
    expect(first).not.toHaveBeenCalled();
    rerender({ refresh: second });
    visibility.mockReturnValue("visible");
    window.dispatchEvent(new Event("focus"));
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    unmount();
  });
});
