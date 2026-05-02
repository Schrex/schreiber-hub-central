import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  reportedByName?: string
  incidentAt?: string
  incidentType?: string
  severity?: string
  jobLabel?: string
  location?: string
  description?: string
  injuredPersonName?: string
  bodyPart?: string
  witnesses?: string
  immediateAction?: string
  contributingFactors?: string
  photoCount?: number
  reportUrl?: string
}

const labelType = (t?: string) => ({
  injury: 'Injury', near_miss: 'Near miss', property_damage: 'Property damage',
  vehicle: 'Vehicle incident', other: 'Other',
} as Record<string, string>)[t ?? ''] ?? t ?? ''

const labelSeverity = (s?: string) => ({
  none: 'No injury', first_aid: 'First aid only', medical_treatment: 'Medical treatment',
  lost_time: 'Lost time', fatality: 'Fatality',
} as Record<string, string>)[s ?? ''] ?? s ?? ''

const AccidentReportEmail: React.FC<Props> = (p) => {
  const urgent = p.severity && ['medical_treatment', 'lost_time', 'fatality'].includes(p.severity)
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{urgent ? 'URGENT — ' : ''}Accident report — {labelType(p.incidentType)} ({p.jobLabel || ''})</Preview>
      <Body style={main}>
        <Container style={container}>
          {urgent && (
            <Section style={urgentBanner}>
              <Text style={urgentText}>⚠ URGENT — {labelSeverity(p.severity)}</Text>
            </Section>
          )}
          <Heading style={h1}>Accident report filed</Heading>
          <Text style={text}>{p.reportedByName ?? 'A team member'} just filed an accident report.</Text>
          <Section style={card}>
            <Text style={row}><strong>Type:</strong> {labelType(p.incidentType)}</Text>
            <Text style={row}><strong>Severity:</strong> {labelSeverity(p.severity)}</Text>
            <Text style={row}><strong>When:</strong> {p.incidentAt}</Text>
            {p.jobLabel ? <Text style={row}><strong>Job:</strong> {p.jobLabel}</Text> : null}
            {p.location ? <Text style={row}><strong>Location:</strong> {p.location}</Text> : null}
            {p.injuredPersonName ? <Text style={row}><strong>Injured person:</strong> {p.injuredPersonName}</Text> : null}
            {p.bodyPart ? <Text style={row}><strong>Body part:</strong> {p.bodyPart}</Text> : null}
            {p.witnesses ? <Text style={row}><strong>Witnesses:</strong> {p.witnesses}</Text> : null}
          </Section>
          <Section style={{ marginTop: 16 }}>
            <Text style={sectionTitle}>What happened</Text>
            <Text style={body}>{p.description}</Text>
            {p.immediateAction ? (<>
              <Text style={sectionTitle}>Immediate action taken</Text>
              <Text style={body}>{p.immediateAction}</Text>
            </>) : null}
            {p.contributingFactors ? (<>
              <Text style={sectionTitle}>Contributing factors</Text>
              <Text style={body}>{p.contributingFactors}</Text>
            </>) : null}
          </Section>
          {p.photoCount ? (
            <Text style={text}>{p.photoCount} photo{p.photoCount === 1 ? '' : 's'} attached — view in app.</Text>
          ) : null}
          <Hr style={hr} />
          <Text style={footer}>Filed via Schreiber Hub.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AccidentReportEmail,
  subject: (d: Props) => {
    const urgent = d?.severity && ['medical_treatment', 'lost_time', 'fatality'].includes(d.severity)
    return `${urgent ? '🚨 URGENT — ' : ''}Accident report: ${labelType(d?.incidentType)}${d?.jobLabel ? ` — ${d.jobLabel}` : ''}`
  },
  displayName: 'Accident report',
  previewData: {
    reportedByName: 'John Smith',
    incidentAt: '2026-05-02 10:15',
    incidentType: 'injury',
    severity: 'first_aid',
    jobLabel: '#24-101 · Smith Farm Drainage',
    location: 'Near excavator on north end',
    description: 'Worker slipped on muddy slope while carrying pipe. Caught himself on rebar.',
    injuredPersonName: 'Mike Jones',
    bodyPart: 'Left forearm — minor scrape',
    witnesses: 'Greg Black',
    immediateAction: 'Cleaned wound, applied bandage from job-site first aid kit. Worker continued shift.',
    contributingFactors: 'Recent rain made slope slippery.',
    photoCount: 2,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: 600, margin: '0 auto', padding: '24px' }
const urgentBanner = { backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }
const urgentText = { color: '#991b1b', fontSize: 16, fontWeight: 700, margin: 0 }
const h1 = { color: '#0f172a', fontSize: 22, margin: '0 0 16px' }
const text = { color: '#334155', fontSize: 15, lineHeight: 1.5, margin: '0 0 12px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px' }
const row = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '4px 0' }
const sectionTitle = { color: '#475569', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, margin: '16px 0 4px', fontWeight: 700 }
const body = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }
