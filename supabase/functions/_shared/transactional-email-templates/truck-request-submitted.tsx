import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  jobNumber?: string
  jobName?: string
  address?: string
  requestedDate?: string
  startTime?: string
  material?: string
  pickupLocation?: string
  dumpLocation?: string
  loadQuantity?: string | number
  notes?: string
  requesterName?: string
  approveUrl?: string
}

const TruckRequestSubmittedEmail: React.FC<Props> = ({
  jobNumber = '',
  jobName = '',
  address = '',
  requestedDate = '',
  startTime = '',
  material = '',
  pickupLocation = '',
  dumpLocation = '',
  loadQuantity = '',
  notes = '',
  requesterName = 'A foreman',
  approveUrl = '',
}) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Truck request — {jobNumber ? `#${jobNumber} · ` : ''}{jobName} on {requestedDate}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New truck request</Heading>
        <Text style={text}>
          {requesterName} requested a truck for the job below. Review and approve in Schreiber Hub.
        </Text>
        <Section style={card}>
          {jobNumber ? <Text style={row}><strong>Job #:</strong> {jobNumber}</Text> : null}
          <Text style={row}><strong>Job:</strong> {jobName}</Text>
          {address ? <Text style={row}><strong>Address:</strong> {address}</Text> : null}
          <Text style={row}><strong>Requested date:</strong> {requestedDate}{startTime ? ` @ ${startTime}` : ''}</Text>
          {material ? <Text style={row}><strong>Material:</strong> {material}</Text> : null}
          {pickupLocation ? <Text style={row}><strong>Pickup:</strong> {pickupLocation}</Text> : null}
          {dumpLocation ? <Text style={row}><strong>Dump:</strong> {dumpLocation}</Text> : null}
          {loadQuantity ? <Text style={row}><strong>Quantity / loads:</strong> {String(loadQuantity)}</Text> : null}
          {notes ? <Text style={row}><strong>Notes:</strong> {notes}</Text> : null}
        </Section>
        {approveUrl ? (
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={approveUrl} style={btn}>Open in Schreiber Hub</Button>
          </Section>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>Requested by {requesterName} via Schreiber Hub.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TruckRequestSubmittedEmail,
  subject: (data: Props) =>
    `Truck request — ${data?.jobNumber ? `#${data.jobNumber} · ` : ''}${data?.jobName ?? ''} (${data?.requestedDate ?? ''})`,
  displayName: 'Truck request submitted',
  previewData: {
    jobNumber: '24-101',
    jobName: 'Smith Farm Drainage',
    address: '1234 Rural Rd, Lancaster PA',
    requestedDate: '2026-05-10',
    startTime: '07:00',
    material: '#57 Stone',
    pickupLocation: 'New Enterprise — Lancaster',
    dumpLocation: '1234 Rural Rd, Lancaster PA',
    loadQuantity: '4 loads',
    notes: 'Need on site by 7am sharp.',
    requesterName: 'Brody Wilson',
    approveUrl: 'https://example.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: 560, margin: '0 auto', padding: '24px' }
const h1 = { color: '#0f172a', fontSize: 22, margin: '0 0 16px' }
const text = { color: '#334155', fontSize: 15, lineHeight: 1.5, margin: '0 0 16px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px' }
const row = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '4px 0' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }
const btn = { backgroundColor: '#facc15', color: '#0f172a', padding: '12px 20px', borderRadius: 8, fontWeight: 700, textDecoration: 'none' }
