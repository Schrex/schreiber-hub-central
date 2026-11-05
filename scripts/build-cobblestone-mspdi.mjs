// Builds a synthetic MSPDI file from e2e/fixtures/cobblestone-tasks.csv.
// This is not Rick's Microsoft Project export. Fake cost tags are included
// so tests can prove the parser drops them.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(root, 'e2e/fixtures/cobblestone-tasks.csv');
const outPath = path.join(root, 'e2e/fixtures/cobblestone.mspdi.xml');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const escapeXml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const stamp = (value) => value && value.length === 16 ? `${value}:00` : value;

const table = parseCsv(readFileSync(csvPath, 'utf8')).filter((record) => record.some((value) => value.length));
const header = table[0];
const index = (name) => header.indexOf(name);
const tasks = table.slice(1).map((record) => ({
  id: record[index('id')],
  uniqueId: record[index('unique_id')],
  wbs: record[index('wbs')],
  outline: record[index('outline_number')],
  level: record[index('outline_level')],
  name: record[index('name')],
  start: record[index('start')],
  finish: record[index('finish')],
  duration: record[index('duration')],
  pct: record[index('pct_complete')],
  summary: record[index('summary')] === 'True',
  predecessors: record[index('predecessors')],
  resources: record[index('resources')],
}));
const byId = new Map(tasks.map((task) => [task.id, task]));
const hours = (duration) => {
  const days = Number(String(duration).replace(/d$/, ''));
  return Number.isFinite(days) ? Math.round(days * 8) : 0;
};

const resources = [
  { uid: 1, name: 'Craft' },
  { uid: 2, name: 'Schreiber' },
  { uid: 3, name: 'Hynes' },
];
const resourceUid = new Map(resources.map((resource) => [resource.name, resource.uid]));

const taskXml = tasks.map((task) => {
  const predecessor = task.predecessors.match(/^(\d+)FS$/)?.[1];
  const predecessorUid = predecessor ? byId.get(predecessor)?.uniqueId : '';
  const cost = task.name === 'Hot Box' ? '<Cost>987654.32</Cost>' : '';
  return `    <Task>
      <UID>${task.uniqueId}</UID>
      <ID>${task.id}</ID>
      <Name>${escapeXml(task.name)}</Name>
      <OutlineLevel>${task.level}</OutlineLevel>
      <OutlineNumber>${escapeXml(task.outline)}</OutlineNumber>
      <WBS>${escapeXml(task.wbs)}</WBS>
      <Start>${stamp(task.start)}</Start>
      <Finish>${stamp(task.finish)}</Finish>
      <Duration>PT${hours(task.duration)}H0M0S</Duration>
      <PercentComplete>${Math.round(Number(task.pct) || 0)}</PercentComplete>
      <Summary>${task.summary ? 1 : 0}</Summary>
      ${predecessorUid ? `<PredecessorLink><PredecessorUID>${predecessorUid}</PredecessorUID><Type>1</Type></PredecessorLink>` : ''}
      ${cost}
    </Task>`;
}).join('\n');

const assignmentXml = tasks
  .filter((task) => !task.summary && resourceUid.has(task.resources))
  .map((task) => `    <Assignment><TaskUID>${task.uniqueId}</TaskUID><ResourceUID>${resourceUid.get(task.resources)}</ResourceUID></Assignment>`)
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!-- SYNTHETIC MSPDI generated from e2e/fixtures/cobblestone-tasks.csv.
     This is not an export from Rick's Microsoft Project file.
     The Cost and StandardRate figures are fake and must never be stored. -->
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Ricks Schedule Cobblestone Project1</Name>
  <StartDate>2026-10-23T08:00:00</StartDate>
  <FinishDate>2026-12-18T12:00:00</FinishDate>
  <CalendarUID>1</CalendarUID>
  <MinutesPerDay>480</MinutesPerDay>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>
        <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
        <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
      </WeekDays>
      <Exceptions>
        <Exception>
          <Name>Thanksgiving</Name>
          <TimePeriod>
            <FromDate>2026-11-26T00:00:00</FromDate>
            <ToDate>2026-11-27T23:59:00</ToDate>
          </TimePeriod>
          <DayWorking>0</DayWorking>
        </Exception>
        <Exception>
          <Name>Christmas</Name>
          <TimePeriod>
            <FromDate>2026-12-25T00:00:00</FromDate>
            <ToDate>2026-12-25T23:59:00</ToDate>
          </TimePeriod>
          <DayWorking>0</DayWorking>
        </Exception>
      </Exceptions>
    </Calendar>
  </Calendars>
  <Tasks>
${taskXml}
  </Tasks>
  <Resources>
    <Resource><UID>1</UID><Name>Craft</Name></Resource>
    <Resource><UID>2</UID><Name>Schreiber</Name><StandardRate>55.55</StandardRate></Resource>
    <Resource><UID>3</UID><Name>Hynes</Name></Resource>
  </Resources>
  <Assignments>
${assignmentXml}
  </Assignments>
</Project>
`;

writeFileSync(outPath, xml);
console.log(`Wrote ${outPath}`);
