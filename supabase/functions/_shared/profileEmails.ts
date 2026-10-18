/** PostgREST embeds may be a single profile or a collection, depending on the relationship. */
export function profileEmails(profile: unknown): string[] {
  const profiles = Array.isArray(profile) ? profile : [profile];
  return profiles.flatMap(value => {
    if (typeof value !== "object" || value === null || !("email" in value)) return [];
    return typeof value.email === "string" && value.email.includes("@") ? [value.email] : [];
  });
}
