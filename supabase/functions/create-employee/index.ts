import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createEmployeeHandler } from './handler.ts'

Deno.serve(createEmployeeHandler(createClient, {
  url: Deno.env.get('SUPABASE_URL')!,
  anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
}))
