import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Contract guard for the access-policy module (#43/#52).
 * UI role gating goes through `can()` / `useAccess()` in src/lib/access*.
 * This test fails when a source file compares a role to a role literal inline.
 */

const SRC = path.resolve(__dirname, "..");
const ROLE = "(?:employee|foreman|office|admin)";
const Q = "[\"'`]";

const PATTERNS: { name: string; re: RegExp }[] = [
  // role === "admin", effectiveRole !== 'office', auth.role == "foreman"
  { name: "role compared to literal", re: new RegExp(`\\w*role\\w*\\??\\s*[!=]==?\\s*${Q}${ROLE}${Q}`, "i") },
  // "admin" === role
  { name: "literal compared to role", re: new RegExp(`${Q}${ROLE}${Q}\\s*[!=]==?\\s*[\\w.?]*role`, "i") },
  // roles.includes("admin"), userRoles.has('office'), roles?.indexOf("foreman")
  { name: "role list membership", re: new RegExp(`\\w*roles?\\w*\\??\\.(?:includes|has|indexOf)\\(\\s*${Q}${ROLE}${Q}`, "i") },
  // switch (role) { case "admin": ... }
  { name: "switch on role", re: new RegExp(`switch\\s*\\(\\s*[\\w.?]*role\\w*\\s*\\)`, "i") },
];

/** The access module and the auth provider (preview internals) may compare roles. */
const EXEMPT = [/^lib\/access/, /^hooks\/useAuth\.tsx$/, /^integrations\//, /^test\//, /\.(test|spec)\.tsx?$/];

/**
 * Explicit exceptions: file + exact line text + reason. Keep this short; each entry
 * must still match a line (stale entries fail) so the list cannot rot.
 */
const ALLOWLIST: { file: string; line: string; reason: string }[] = [];

export function findInlineRoleChecks(source: string): { line: number; text: string; pattern: string }[] {
  const hits: { line: number; text: string; pattern: string }[] = [];
  source.split("\n").forEach((text, i) => {
    const code = text.replace(/\/\/.*$/, "");
    for (const p of PATTERNS) {
      if (p.re.test(code)) {
        hits.push({ line: i + 1, text: text.trim(), pattern: p.name });
        break;
      }
    }
  });
  return hits;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(e.name) ? [full] : [];
  });
}

describe("inline role check guard", () => {
  it("detects the comparison styles it guards against", () => {
    const bad = [
      `const isAdmin = role === "admin";`,
      `if (effectiveRole !== 'office') return;`,
      `const ok = auth.role == "foreman";`,
      `if ("admin" === role) {}`,
      `roles.includes("admin")`,
      `userRoles?.has('office')`,
      `switch (effectiveRole) {`,
    ];
    for (const s of bad) expect(findInlineRoleChecks(s), s).toHaveLength(1);
  });

  it("ignores access calls, other users' role sets and comments", () => {
    const ok = [
      `const isAdmin = can("timeOff.approve");`,
      `const fieldRole = s.has("foreman") || s.has("employee");`,
      `// role === "admin" used to live here`,
      `const NOTICE: Record<Role, number> = { employee: 14, foreman: 28, office: 14, admin: 14 };`,
      `title.toLowerCase().includes("foreman")`,
    ];
    for (const s of ok) expect(findInlineRoleChecks(s), s).toHaveLength(0);
  });

  it("finds no inline role comparisons outside src/lib/access* and useAuth", () => {
    const offenders: string[] = [];
    const usedAllow = new Set<number>();
    for (const file of sourceFiles(SRC)) {
      const rel = path.relative(SRC, file).split(path.sep).join("/");
      if (EXEMPT.some((re) => re.test(rel))) continue;
      for (const hit of findInlineRoleChecks(readFileSync(file, "utf8"))) {
        const allowed = ALLOWLIST.findIndex((a) => a.file === rel && a.line === hit.text);
        if (allowed >= 0) usedAllow.add(allowed);
        else offenders.push(`src/${rel}:${hit.line} [${hit.pattern}] ${hit.text}`);
      }
    }
    expect(offenders, "Use useAccess().can(action) from src/lib/access instead").toEqual([]);
    const stale = ALLOWLIST.filter((_, i) => !usedAllow.has(i)).map((a) => `${a.file}: ${a.line}`);
    expect(stale, "Remove stale allowlist entries").toEqual([]);
  });
});
