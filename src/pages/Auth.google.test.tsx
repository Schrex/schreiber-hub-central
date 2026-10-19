import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Auth from "./Auth";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), toast: vi.fn(), session: false }));
vi.mock("@/integrations/auth/google", () => ({ signInWithGoogle: mocks.signIn }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ session: mocks.session ? { user: { id: "synthetic" } } : null, loading: false }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toast } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = false;
  vi.stubEnv("VITE_LOCAL_BACKEND", "false");
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

function renderAuth() {
  return render(<MemoryRouter initialEntries={["/auth"]}>
    <Routes><Route path="/auth" element={<Auth />} /><Route path="/" element={<p>Signed in home</p>} /></Routes>
  </MemoryRouter>);
}

it("shows a generic error and allows retry after a thrown OAuth failure", async () => {
  mocks.signIn.mockRejectedValue(new Error("private provider detail"));
  renderAuth();
  fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith("Google sign-in failed"));
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  expect(screen.queryByText("private provider detail")).not.toBeInTheDocument();
});

it("keeps Google disabled in synthetic local mode", () => {
  vi.stubEnv("VITE_LOCAL_BACKEND", "true");
  renderAuth();
  const button = screen.getByRole("button", { name: "Continue with Google" });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(mocks.signIn).not.toHaveBeenCalled();
});

it("routes a session restored by the Auth provider to home without starting OAuth", async () => {
  mocks.session = true;
  renderAuth();
  expect(await screen.findByText("Signed in home")).toBeInTheDocument();
  expect(mocks.signIn).not.toHaveBeenCalled();
});
