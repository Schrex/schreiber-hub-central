import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  requesterName?: string
  type?: string
  dateRange?: string
  halfDay?: string
  reason?: string
  decidedBy?: string
}

const TimeOffApprovedEmail: React.FC<Props> = ({
  requesterName = 'Employee',
  type = 'Vacation',
  dateRange = '',
  halfDay = '',
  reason = '',
  decidedBy = 'Admin',
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Approved time off — {requesterName} ({dateRange})
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Time off approved</Heading>
        <Text style={text}>
          The following time off request has been <strong>approved</strong>.
        </Text>
        <Section style={card}>
          <Text style={row}>
            <strong>Employee:</strong> {requesterName}
          </Text>
          <Text style={row}>
            <strong>Type:</strong> {type}
          </Text>
          <Text style={row}>
            <strong>Dates:</strong> {dateRange}
          </Text>
          {halfDay ? (
            <Text style={row}>
              <strong>Half day:</strong> {halfDay}
            </Text>
          ) : null}
          {reason ? (
            <Text style={row}>
              <strong>Reason:</strong> {reason}
            </Text>
          ) : null}
          <Text style={row}>
            <strong>Approved by:</strong> {decidedBy}
          </Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          You are receiving this because you are an admin, foreman, or
          equipment manager at Schreiber Excavating.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TimeOffApprovedEmail,
  subject: (data: Props) =>
    `Time off approved — ${data?.requesterName ?? 'Employee'} (${data?.dateRange ?? ''})`,
  displayName: 'Time off approved',
  previewData: {
    requesterName: 'Jane Doe',
    type: 'Vacation',
    dateRange: 'May 5 → May 9, 2026 · 5 days',
    halfDay: '',
    reason: 'Family vacation',
    decidedBy: 'Zach Schreiber',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: 560, margin: '0 auto', padding: '24px' }
const h1 = { color: '#0f172a', fontSize: 22, margin: '0 0 16px' }
const text = { color: '#334155', fontSize: 15, lineHeight: 1.5, margin: '0 0 16px' }
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '16px 20px',
}
const row = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '4px 0' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }
