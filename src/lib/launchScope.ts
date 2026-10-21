/** Deferred integrations stay off for both independent launch and rehearsal builds. */
export const independentLaunch = import.meta.env.VITE_INDEPENDENT_LAUNCH === "true"
  || import.meta.env.VITE_REHEARSAL_BACKEND === "true";
