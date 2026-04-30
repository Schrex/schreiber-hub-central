import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  jobNumber?: string
  jobName?: string
  address?: string
  customer?: string
  gc?: string
  onSiteName?: string
  onSitePhone?: string
  startDate?: string
  endDate?: string
  notes?: string
  requestedByName?: string
}

const SafetyInspectionRequestEmail: React.FC<Props> = ({
  jobNumber = '',
  jobName = '',
  address = '',
  customer = '',
  gc = '',
  onSiteName = '',
  onSitePhone = '',
  startDate = '',
  endDate = '',
  notes = '',
  requestedByName = 'Schreiber Excavating',
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Safety inspection request — {jobNumber ? `#${jobNumber} · ` : ''}{jobName}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Safety inspection request</Heading>
        <Text style={text}>
          Please add the following job to your safety inspection list. Job details below.
        </Text>
        <Section style={card}>
          {jobNumber ? <Text style={row}><strong>Job #:</strong> {jobNumber}</Text> : null}
          <Text style={row}><strong>Job:</strong> {jobName}</Text>
          {address ? <Text style={row}><strong>Address:</strong> {address}</Text> : null}
          {customer ? <Text style={row}><strong>Customer:</strong> {customer}</Text> : null}
          {gc ? <Text style={row}><strong>GC:</strong> {gc}</Text> : null}
          {onSiteName ? <Text style={row}><strong>On-site contact:</strong> {onSiteName}</Text> : null}
          {onSitePhone ? <Text style={row}><strong>On-site phone:</strong> {onSitePhone}</Text> : null}
          {(startDate || endDate) ? (
            <Text style={row}><strong>Dates:</strong> {startDate || '?'} → {endDate || '?'}</Text>
          ) : null}
          {notes ? <Text style={row}><strong>Notes:</strong> {notes}</Text> : null}
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Requested by {requestedByName} via Schreiber Hub.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SafetyInspectionRequestEmail,
  subject: (data: Props) =>
    `Safety inspection request — ${data?.jobNumber ? `#${data.jobNumber} · ` : ''}${data?.jobName ?? ''}`,
  displayName: 'Safety inspection request',
  previewData: {
    jobNumber: '24-101',
    jobName: 'Smith Farm Drainage',
    address: '1234 Rural Rd, Lancaster PA',
    customer: 'Smith Farms LLC',
    gc: 'Acme Builders',
    onSiteName: 'John Smith',
    onSitePhone: '717-555-1234',
    startDate: '2026-05-01',
    endDate: '2026-06-15',
    notes: 'Active dig site — please coordinate inspection times with foreman.',
    requestedByName: 'Zach Schreiber',
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
