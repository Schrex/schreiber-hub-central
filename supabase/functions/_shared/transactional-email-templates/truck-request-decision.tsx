import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  decision?: 'approved' | 'declined'
  jobNumber?: string
  jobName?: string
  requestedDate?: string
  startTime?: string
  material?: string
  pickupLocation?: string
  dumpLocation?: string
  loadQuantity?: string | number
  assignedTruckNumber?: string
  assignedDriverName?: string
  decisionNotes?: string
  decidedByName?: string
}

const TruckRequestDecisionEmail: React.FC<Props> = ({
  decision = 'approved',
  jobNumber = '',
  jobName = '',
  requestedDate = '',
  startTime = '',
  material = '',
  pickupLocation = '',
  dumpLocation = '',
  loadQuantity = '',
  assignedTruckNumber = '',
  assignedDriverName = '',
  decisionNotes = '',
  decidedByName = 'Office',
}) => {
  const approved = decision === 'approved'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        Truck request {approved ? 'approved' : 'declined'} — {jobNumber ? `#${jobNumber} · ` : ''}{jobName}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={{ ...h1, color: approved ? '#15803d' : '#b91c1c' }}>
            Truck request {approved ? 'approved' : 'declined'}
          </Heading>
          <Text style={text}>
            Your truck request for {jobNumber ? `#${jobNumber} · ` : ''}{jobName} on {requestedDate} was {approved ? 'approved' : 'declined'} by {decidedByName}.
          </Text>
          <Section style={card}>
            <Text style={row}><strong>Date:</strong> {requestedDate}{startTime ? ` @ ${startTime}` : ''}</Text>
            {material ? <Text style={row}><strong>Material:</strong> {material}</Text> : null}
            {pickupLocation ? <Text style={row}><strong>Pickup:</strong> {pickupLocation}</Text> : null}
            {dumpLocation ? <Text style={row}><strong>Dump:</strong> {dumpLocation}</Text> : null}
            {loadQuantity ? <Text style={row}><strong>Quantity / loads:</strong> {String(loadQuantity)}</Text> : null}
            {approved && assignedTruckNumber ? <Text style={row}><strong>Assigned truck:</strong> {assignedTruckNumber}</Text> : null}
            {approved && assignedDriverName ? <Text style={row}><strong>Driver:</strong> {assignedDriverName}</Text> : null}
            {decisionNotes ? <Text style={row}><strong>{approved ? 'Notes' : 'Reason'}:</strong> {decisionNotes}</Text> : null}
          </Section>
          <Hr style={hr} />
          <Text style={footer}>Schreiber Hub · Trucking</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TruckRequestDecisionEmail,
  subject: (data: Props) =>
    `Truck request ${data?.decision === 'declined' ? 'declined' : 'approved'} — ${data?.jobNumber ? `#${data.jobNumber} · ` : ''}${data?.jobName ?? ''}`,
  displayName: 'Truck request decision',
  previewData: {
    decision: 'approved',
    jobNumber: '24-101',
    jobName: 'Smith Farm Drainage',
    requestedDate: '2026-05-10',
    startTime: '07:00',
    material: '#57 Stone',
    pickupLocation: 'New Enterprise — Lancaster',
    dumpLocation: '1234 Rural Rd, Lancaster PA',
    loadQuantity: '4 loads',
    assignedTruckNumber: 'T-12',
    assignedDriverName: 'Greg Black',
    decisionNotes: 'Confirmed with quarry.',
    decidedByName: 'Megan (Office)',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: 560, margin: '0 auto', padding: '24px' }
const h1 = { fontSize: 22, margin: '0 0 16px' }
const text = { color: '#334155', fontSize: 15, lineHeight: 1.5, margin: '0 0 16px' }
const card = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px' }
const row = { color: '#0f172a', fontSize: 14, lineHeight: 1.6, margin: '4px 0' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0' }
const footer = { color: '#94a3b8', fontSize: 12, lineHeight: 1.5 }
