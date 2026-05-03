import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface ViolationRow { rule?: string; description?: string; corrective_codes?: number[]; corrective_other?: string }

interface Props {
  filedByName?: string
  employeeName?: string
  department?: string
  violationDate?: string
  jobLabel?: string
  violations?: ViolationRow[]
  comments?: string
  disciplinaryAction?: string
  suspensionFrom?: string
  suspensionTo?: string
  photoCount?: number
}

const labelDiscipline = (d?: string) => ({
  verbal: 'Verbal reprimand',
  written: 'Written reprimand (last chance)',
  suspension: 'Suspension',
  termination: 'Termination',
} as Record<string, string>)[d ?? ''] ?? d ?? ''

const codeLabel = (c: number) => ({
  1: 'Cease operation until corrected',
  2: 'Warn and instruct on proper procedures',
  3: 'Provide proper equipment',
  4: 'Change procedure/work method',
  5: 'Initiate and complete corrective action',
  6: 'Other',
} as Record<number, string>)[c] ?? `Code ${c}`

const SafetyViolationEmail: React.FC<Props> = (p) => {
  const urgent = p.disciplinaryAction === 'termination' || p.disciplinaryAction === 'suspension'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{urgent ? 'URGENT — ' : ''}Safety violation issued to {p.employeeName} ({p.jobLabel || ''})</Preview>
      <Body style={main}>
        <Container style={container}>
          {urgent && (
            <Section style={urgentBanner}>
              <Text style={urgentText}>⚠ {labelDiscipline(p.disciplinaryAction)}</Text>
            </Section>
          )}
          <Heading style={h1}>Safety violation notice filed</Heading>
          <Text style={text}>{p.filedByName ?? 'A supervisor'} issued a safety violation notice.</Text>
          <Section style={card}>
            <Text style={row}><strong>Employee:</strong> {p.employeeName}</Text>
            {p.department ? <Text style={row}><strong>Department:</strong> {p.department}</Text> : null}
            <Text style={row}><strong>Date:</strong> {p.violationDate}</Text>
            {p.jobLabel ? <Text style={row}><strong>Job:</strong> {p.jobLabel}</Text> : null}
            <Text style={row}><strong>Disciplinary action:</strong> {labelDiscipline(p.disciplinaryAction)}</Text>
            {p.disciplinaryAction === 'suspension' && (p.suspensionFrom || p.suspensionTo) ? (
              <Text style={row}><strong>Suspension:</strong> {p.suspensionFrom ?? '?'} → {p.suspensionTo ?? '?'}</Text>
            ) : null}
          </Section>

          <Text style={sectionTitle}>Violations</Text>
          {(p.violations ?? []).map((v, i) => (
            <Section key={i} style={violationCard}>
              <Text style={row}><strong>{i + 1}) {v.rule || 'Rule'}:</strong> {v.description || ''}</Text>
              {Array.isArray(v.corrective_codes) && v.corrective_codes.length > 0 ? (
                <Text style={smallRow}>Corrective: {v.corrective_codes.map(codeLabel).join(' · ')}{v.corrective_other ? ` — ${v.corrective_other}` : ''}</Text>
              ) : null}
            </Section>
          ))}

          {p.comments ? (<>
            <Text style={sectionTitle}>Comments</Text>
            <Text style={body}>{p.comments}</Text>
          </>) : null}

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
  component: SafetyViolationEmail,
  subject: (d: Props) => {
    const urgent = d?.disciplinaryAction === 'termination' || d?.disciplinaryAction === 'suspension'
    return `${urgent ? '🚨 ' : ''}Safety violation: ${d?.employeeName ?? ''}${d?.jobLabel ? ` — ${d.jobLabel}` : ''}`
  },
  displayName: 'Safety violation notice',
  previewData: {
    filedByName: 'Greg Black',
    employeeName: 'Mike Jones',
    department: 'Field crew',
    violationDate: '2026-05-02',
    jobLabel: '#24-101 · Smith Farm Drainage',
    violations: [
      { rule: 'PPE', description: 'No hard hat in active excavation', corrective_codes: [2, 3] },
    ],
    comments: 'Supplied hard hat from truck. Re-trained on PPE policy.',
    disciplinaryAction: 'verbal',
    photoCount: 1,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: 600, margin: '0 auto', padding: '24px' }
const urgentBanner = { backgroundColor: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }
const urgentText = { color: '#991b1b', fontSize: 16, fontWeight: 700, margin: 0 }
const h1 = { color: '#0f172a', fontSize: 22, margin: '0 0 16px' }
const text = { color: '#334155', fontSize: 15, lineHeight: 1.5, margin: '0 0 12px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px' }
const violationCard = { backgroundColor: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }
const row = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '4px 0' }
const smallRow = { color: '#475569', fontSize: 12, lineHeight: 1.5, margin: '2px 0' }
const sectionTitle = { color: '#475569', fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, margin: '16px 0 4px', fontWeight: 700 }
const body = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '0 0 8px', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }
