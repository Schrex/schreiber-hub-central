import * as React from 'npm:react@18.3.1'
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Hr,
} from 'npm:@react-email/components@0.0.22'

interface Props {
  recipientName?: string
  documentTitle?: string
  signUrl?: string
  senderName?: string
}

export const NewHireDocument: React.FC<Props> = ({
  recipientName = 'New Team Member',
  documentTitle = 'New-hire paperwork',
  signUrl = 'https://example.com',
  senderName = 'Schreiber Excavating',
}) => (
  <Html>
    <Head />
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
        <Heading style={{ color: '#0f172a', fontSize: 22 }}>
          You have paperwork to sign
        </Heading>
        <Text style={{ color: '#334155', fontSize: 15, lineHeight: 1.5 }}>
          Hi {recipientName},
        </Text>
        <Text style={{ color: '#334155', fontSize: 15, lineHeight: 1.5 }}>
          {senderName} has sent you a document — <strong>{documentTitle}</strong> —
          that needs your review and signature. You can review and sign it
          right from the app.
        </Text>
        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button
            href={signUrl}
            style={{
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Open & Sign
          </Button>
        </Section>
        <Hr style={{ borderColor: '#e2e8f0' }} />
        <Text style={{ color: '#64748b', fontSize: 12 }}>
          If the button doesn't work, copy this link into your browser:
          <br />
          <a href={signUrl} style={{ color: '#f59e0b' }}>
            {signUrl}
          </a>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewHireDocument,
  subject: (data: Props) =>
    `Action required: sign ${data?.documentTitle ?? 'your new-hire paperwork'}`,
  displayName: 'New-hire document to sign',
  previewData: {
    recipientName: 'Alex Rivera',
    documentTitle: 'W-4 Federal Tax Withholding',
    signUrl: 'https://schreiberhub.app/my-documents',
    senderName: 'Schreiber Excavating',
  },
}
