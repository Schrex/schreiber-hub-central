import * as React from 'npm:react@18.3.1'
import { template as newHireDocument } from './new-hire-document.tsx'
import { template as timeOffApproved } from './time-off-approved.tsx'
import { template as safetyInspectionRequest } from './safety-inspection-request.tsx'
import { template as truckRequestSubmitted } from './truck-request-submitted.tsx'
import { template as truckRequestDecision } from './truck-request-decision.tsx'
import { template as safetyTalkSummary } from './safety-talk-summary.tsx'
import { template as accidentReport } from './accident-report.tsx'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, unknown>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-hire-document': newHireDocument,
  'time-off-approved': timeOffApproved,
  'safety-inspection-request': safetyInspectionRequest,
  'truck-request-submitted': truckRequestSubmitted,
  'truck-request-decision': truckRequestDecision,
  'safety-talk-summary': safetyTalkSummary,
  'accident-report': accidentReport,
}
