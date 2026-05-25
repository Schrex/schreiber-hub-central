import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// Renders inline markdown: **bold**, *italic*, `code`
const renderInline = (text: string) => {
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) parts.push(<code key={i++} className="rounded bg-muted px-1 py-0.5 text-[0.85em]">{tok.slice(1, -1)}</code>);
    else parts.push(<em key={i++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

const parseBlocks = (lines: string[]): Block[] => {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const ul = line.match(/^\s*[-*]\s+(.*)/);
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    if (ul) {
      const items: string[] = [];
      while (i < lines.length) {
        const mm = lines[i].match(/^\s*[-*]\s+(.*)/);
        if (!mm) break;
        items.push(mm[1]);
        i++;
      }
      blocks.push({ kind: "ul", items });
    } else if (ol) {
      const items: string[] = [];
      while (i < lines.length) {
        const mm = lines[i].match(/^\s*\d+\.\s+(.*)/);
        if (!mm) break;
        items.push(mm[1]);
        i++;
      }
      blocks.push({ kind: "ol", items });
    } else {
      const buf: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() && !lines[i].match(/^\s*([-*]|\d+\.)\s+/) && !isHeading(lines[i])) {
        buf.push(lines[i]); i++;
      }
      blocks.push({ kind: "p", text: buf.join(" ") });
    }
  }
  return blocks;
};

const isHeading = (line: string) =>
  /^#{1,6}\s+/.test(line) || /^\*\*[^*]+\*\*:?\s*$/.test(line.trim());

const stripHeading = (line: string) => {
  const h = line.match(/^#{1,6}\s+(.*)$/);
  if (h) return h[1].replace(/:$/, "").trim();
  const b = line.trim().match(/^\*\*(.+?)\*\*:?$/);
  if (b) return b[1].trim();
  return line.trim();
};

interface Section { title: string; body: string[]; }

const parseSections = (md: string): { intro: string[]; sections: Section[] } => {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const intro: string[] = [];
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    if (isHeading(line)) {
      if (current) sections.push(current);
      current = { title: stripHeading(line), body: [] };
    } else if (current) {
      current.body.push(line);
    } else {
      intro.push(line);
    }
  }
  if (current) sections.push(current);
  return { intro, sections };
};

const Blocks = ({ blocks }: { blocks: Block[] }) => (
  <div className="space-y-2 text-sm leading-relaxed">
    {blocks.map((b, i) => {
      if (b.kind === "p") return <p key={i}>{renderInline(b.text)}</p>;
      if (b.kind === "ul")
        return (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
          </ul>
        );
      return (
        <ol key={i} className="list-decimal space-y-1 pl-5">
          {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
        </ol>
      );
    })}
  </div>
);

export const ForemanBriefView = ({ markdown }: { markdown: string }) => {
  const { intro, sections } = parseSections(markdown);
  const introBlocks = parseBlocks(intro);

  if (sections.length === 0) {
    return <Blocks blocks={parseBlocks(markdown.split("\n"))} />;
  }

  return (
    <div className="space-y-3">
      {introBlocks.length > 0 && <Blocks blocks={introBlocks} />}
      <Accordion
        type="multiple"
        defaultValue={sections.map((_, i) => `s-${i}`)}
        className="space-y-1"
      >
        {sections.map((s, i) => (
          <AccordionItem
            key={i}
            value={`s-${i}`}
            className="rounded-lg border border-border bg-background/40"
          >
            <AccordionTrigger className="px-3 py-2 font-display text-sm font-semibold uppercase tracking-wide hover:no-underline">
              {s.title}
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-3">
              <Blocks blocks={parseBlocks(s.body)} />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};
