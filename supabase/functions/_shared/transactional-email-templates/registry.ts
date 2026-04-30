import * as React from 'npm:react@18.3.1'
import { template as newHireDocument } from './new-hire-document.tsx'
import { template as timeOffApproved } from './time-off-approved.tsx'
import { template as safetyInspectionRequest } from './safety-inspection-request.tsx'

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
}
