import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface AttendeeSummary {
  name: string
  signed: boolean
  quizScore?: number | null
  quizTotal?: number | null
}

interface Props {
  talkTitle?: string
  talkCategory?: string
  jobNumber?: string
  jobName?: string
  address?: string
  customer?: string
  gc?: string
  foremanName?: string
  heldAt?: string
  attendees?: AttendeeSummary[]
  transcript?: string
  talkContent?: string
}

const SafetyTalkSummaryEmail: React.FC<Props> = ({
  talkTitle = 'Toolbox talk',
  talkCategory = '',
  jobNumber = '',
  jobName = '',
  address = '',
  customer = '',
  gc = '',
  foremanName = 'Foreman',
  heldAt = '',
  attendees = [],
  transcript = '',
  talkContent = '',
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Safety talk completed — {talkTitle}{jobName ? ` · ${jobName}` : ''}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Safety talk completed</Heading>
        <Text style={text}>
          {foremanName} delivered the toolbox talk below to the crew. Every
          attendee passed the quiz and signed off.
        </Text>

        <Section style={card}>
          {talkCategory ? <Text style={row}><strong>Category:</strong> {talkCategory}</Text> : null}
          <Text style={row}><strong>Talk:</strong> {talkTitle}</Text>
          {heldAt ? <Text style={row}><strong>Held:</strong> {heldAt}</Text> : null}
          {jobNumber ? <Text style={row}><strong>Job #:</strong> {jobNumber}</Text> : null}
          {jobName ? <Text style={row}><strong>Job:</strong> {jobName}</Text> : null}
          {address ? <Text style={row}><strong>Address:</strong> {address}</Text> : null}
          {customer ? <Text style={row}><strong>Customer:</strong> {customer}</Text> : null}
          {gc ? <Text style={row}><strong>GC:</strong> {gc}</Text> : null}
          <Text style={row}><strong>Foreman:</strong> {foremanName}</Text>
        </Section>

        <Heading as="h2" style={h2}>Attendees ({attendees.length})</Heading>
        <Section style={card}>
          {attendees.map((a, i) => (
            <Text key={i} style={row}>
              ✓ {a.name}
              {typeof a.quizScore === 'number' && typeof a.quizTotal === 'number'
                ? ` — quiz ${a.quizScore}/${a.quizTotal}`
                : ''}
              {a.signed ? ' — signed' : ''}
            </Text>
          ))}
          {attendees.length === 0 ? <Text style={row}>No attendees recorded.</Text> : null}
        </Section>

        {talkContent ? (
          <>
            <Heading as="h2" style={h2}>Talk content</Heading>
            <Section style={card}>
              <Text style={pre}>{talkContent}</Text>
            </Section>
          </>
        ) : null}

        {transcript ? (
          <>
            <Heading as="h2" style={h2}>Transcript</Heading>
            <Section style={card}>
              <Text style={pre}>{transcript}</Text>
            </Section>
          </>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>
          Sent automatically by Schreiber Hub when {foremanName} completed the talk.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SafetyTalkSummaryEmail,
  subject: (data: Props) =>
    `Safety talk completed — ${data?.talkTitle ?? 'Toolbox talk'}${data?.jobName ? ` · ${data.jobName}` : ''}`,
  displayName: 'Safety talk summary',
  previewData: {
    talkTitle: 'Trench shoring basics',
    talkCategory: 'Excavation',
    jobNumber: '24-101',
    jobName: 'Smith Farm Drainage',
    address: '1234 Rural Rd, Lancaster PA',
    customer: 'Smith Farms LLC',
    gc: 'Acme Builders',
    foremanName: 'Ed Stokes',
    heldAt: 'May 2, 2026 — 7:12 AM',
    attendees: [
      { name: 'Corey Mahoney', signed: true, quizScore: 3, quizTotal: 3 },
      { name: 'Josh Syrell', signed: true, quizScore: 3, quizTotal: 3 },
    ],
    transcript: 'Alright fellas, gather up. Today we\'re talking about trench shoring...',
    talkContent: '**Why it matters** — Cave-ins kill. **Hazards** — ...',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: 620, margin: '0 auto', padding: '24px' }
const h1 = { color: '#0f172a', fontSize: 22, margin: '0 0 12px' }
const h2 = { color: '#0f172a', fontSize: 16, margin: '20px 0 8px' }
const text = { color: '#334155', fontSize: 15, lineHeight: 1.5, margin: '0 0 16px' }
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '14px 18px',
}
const row = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '4px 0' }
const pre = { color: '#0f172a', fontSize: 13, lineHeight: 1.55, margin: '4px 0', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }
