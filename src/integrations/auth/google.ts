import { supabase } from "../supabase/client";

/** Opt-in migration path; the existing Lovable deployment remains the default. */
export async function signInWithGoogle() {
  if (import.meta.env.VITE_LOCAL_BACKEND === "true") {
    throw new Error("Google sign-in is disabled in the synthetic local environment");
  }

  const mode = import.meta.env.VITE_GOOGLE_AUTH_MODE || "lovable";
  if (mode === "supabase") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    if (!data.url) throw new Error("Google sign-in did not return a redirect URL");
    // Supabase performs the redirect and consumes the callback using the existing
    // client's URL/session handling. There are no broker tokens to set here.
    return;
  }
  if (mode !== "lovable") throw new Error("Unknown Google authentication mode");

  const { lovable } = await import("../lovable/index");
  const result = await lovable.auth.signInWithOAuth("google", {
    redirect_uri: window.location.origin,
  });
  if (result.error) throw result.error;
}
