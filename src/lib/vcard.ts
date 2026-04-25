// Helpers for generating and downloading vCards (RFC 6350)

const escape = (val: string) =>
  val.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export interface VCardInput {
  fullName: string;
  organization?: string;
  title?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string;
}

export const buildVCard = (c: VCardInput): string => {
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];
  lines.push(`FN:${escape(c.fullName)}`);
  // N: family;given;additional;prefix;suffix
  const parts = c.fullName.trim().split(/\s+/);
  const given = parts.shift() ?? "";
  const family = parts.join(" ");
  lines.push(`N:${escape(family)};${escape(given)};;;`);
  if (c.organization) lines.push(`ORG:${escape(c.organization)}`);
  if (c.title) lines.push(`TITLE:${escape(c.title)}`);
  if (c.phone) lines.push(`TEL;TYPE=CELL:${escape(c.phone)}`);
  if (c.email) lines.push(`EMAIL;TYPE=INTERNET:${escape(c.email)}`);
  if (c.website) lines.push(`URL:${escape(c.website)}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${escape(c.address)};;;;`);
  if (c.notes) lines.push(`NOTE:${escape(c.notes)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
};

const triggerDownload = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe = filename.replace(/[^a-z0-9-_ ]/gi, "_").trim() || "contacts";
  a.download = `${safe}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadVCard = (c: VCardInput, filename?: string) => {
  triggerDownload(buildVCard(c), filename ?? c.fullName);
};

export const downloadVCards = (cards: VCardInput[], filename = "contacts") => {
  if (!cards.length) return;
  const content = cards.map(buildVCard).join("\r\n");
  triggerDownload(content, filename);
};
