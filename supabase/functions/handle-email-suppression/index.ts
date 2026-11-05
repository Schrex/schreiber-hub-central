import { handlePostmarkSuppression } from '../_shared/postmark-suppression.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Postmark bounce/complaint/unsubscribe webhook. Verification and payload
// handling live in _shared/postmark-suppression.ts.
Deno.serve((req) => handlePostmarkSuppression(req, {
  secret: Deno.env.get('POSTMARK_WEBHOOK_SECRET'),
  serverId: Deno.env.get('POSTMARK_SERVER_ID'),
  stream: Deno.env.get('POSTMARK_MESSAGE_STREAM'),
  suppress: async (row) => {
    const url = Deno.env.get('SUPABASE_URL')
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !key) throw new Error('Missing database configuration')
    const { error } = await createClient(url, key).from('suppressed_emails')
      .upsert(row, { onConflict: 'email', ignoreDuplicates: true })
    if (error) throw new Error('Suppression write failed')
  },
}))
