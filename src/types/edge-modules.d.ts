// Edge functions import Supabase through Deno's `npm:` specifier. Vitest and the app typecheck
// reach those shared helpers through src/test, so map the specifier to the installed package's types.
declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
