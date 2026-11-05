/** Deferred integrations stay off for both independent launch and rehearsal builds. */
export const independentLaunch = import.meta.env.VITE_INDEPENDENT_LAUNCH === "true"
  || import.meta.env.VITE_REHEARSAL_BACKEND === "true";

/**
 * AI and crew-SMS integrations are parked: their Edge functions live in `parked/` and are not
 * deployed, so their UI stays off in every build until they are restored (see parked/README.md).
 */
export const integrationsParked: boolean = true;
