/** Deferred integrations stay off for both independent launch and rehearsal builds. */
export const independentLaunch = import.meta.env.VITE_INDEPENDENT_LAUNCH === "true"
  || import.meta.env.VITE_REHEARSAL_BACKEND === "true";

/**
 * AI and crew-SMS integrations are parked: their Edge functions live in `parked/` and are not
 * deployed, so their UI stays off in every build until they are restored (see parked/README.md).
 */
export const integrationsParked: boolean = true;

/**
 * The hub's old Schedule page is parked (#99): "Schedule" opens the Daily Schedule at
 * /daily-schedule/, a separate app the hub forwards to. Set to false to bring the old page back
 * at /schedule; its code and the schedule_assignments table are kept (see parked/README.md).
 */
export const schedulePageParked: boolean = true;
