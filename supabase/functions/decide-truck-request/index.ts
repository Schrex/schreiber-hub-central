import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Body {
  requestId: string
  decision: 'approved' | 'declined'
  // Only required when decision === 'approved'
  truckNumber?: string
  driverUserId?: string | null
  driverName?: string | null
  notes?: string | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', user.id)
    const allowed = (roles ?? []).some((r: any) => ['office', 'admin'].includes(r.role))
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const body = (await req.json()) as Body
    if (!body?.requestId || !body?.decision) {
      return new Response(JSON.stringify({ error: 'requestId and decision are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (body.decision === 'approved' && !body.truckNumber) {
      return new Response(JSON.stringify({ error: 'truckNumber is required to approve' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: request, error: reqErr } = await admin
      .from('truck_requests')
      .select('*, jobs(id, job_number, name, address, customer, gc)')
      .eq('id', body.requestId)
      .maybeSingle()
    if (reqErr || !request) throw new Error('Request not found')
    if (request.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Already ${request.status}` }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const job = (request as any).jobs
    let dispatchOrderId: string | null = null

    if (body.decision === 'approved') {
      // Resolve driver name if only id given
      let driverName = body.driverName ?? null
      if (!driverName && body.driverUserId) {
        const { data: prof } = await admin.from('profiles').select('display_name').eq('user_id', body.driverUserId).maybeSingle()
        driverName = prof?.display_name ?? null
      }

      const { data: order, error: ordErr } = await admin.from('dispatch_orders').insert({
        dispatch_date: request.requested_date,
        start_time: request.start_time,
        truck_number: body.truckNumber,
        driver_user_id: body.driverUserId ?? null,
        driver_name: driverName,
        job_id: job?.id ?? null,
        job_name: job?.name ?? null,
        customer: job?.customer ?? null,
        gc: job?.gc ?? null,
        material: request.material,
        pickup_location: request.pickup_location,
        dump_location: request.dump_location ?? job?.address ?? null,
        load_quantity: request.load_quantity,
        notes: [request.requester_notes, body.notes].filter(Boolean).join(' — ') || null,
        status: 'scheduled',
        created_by: user.id,
      }).select('id').single()
      if (ordErr) throw ordErr
      dispatchOrderId = order.id

      await admin.from('truck_requests').update({
        status: 'approved',
        assigned_truck_number: body.truckNumber,
        assigned_driver_user_id: body.driverUserId ?? null,
        assigned_driver_name: driverName,
        decision_notes: body.notes ?? null,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        dispatch_order_id: dispatchOrderId,
      }).eq('id', body.requestId)
    } else {
      await admin.from('truck_requests').update({
        status: 'declined',
        decision_notes: body.notes ?? null,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
      }).eq('id', body.requestId)
    }

    // Email the requester
    let recipient: string | null = null
    if (request.requester_id) {
      const { data: prof } = await admin.from('profiles').select('email, display_name').eq('user_id', request.requester_id).maybeSingle()
      recipient = prof?.email ?? null
    }

    const { data: deciderProf } = await admin.from('profiles').select('display_name, email').eq('user_id', user.id).maybeSingle()
    const decidedByName = deciderProf?.display_name || deciderProf?.email || 'Office'

    if (recipient) {
      try {
        await admin.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'truck-request-decision',
            recipientEmail: recipient,
            idempotencyKey: `truck-request-decision-${body.requestId}-${body.decision}`,
            templateData: {
              decision: body.decision,
              jobNumber: job?.job_number ?? '',
              jobName: job?.name ?? '',
              requestedDate: request.requested_date,
              startTime: request.start_time ?? '',
              material: request.material ?? '',
              pickupLocation: request.pickup_location ?? '',
              dumpLocation: request.dump_location ?? '',
              loadQuantity: request.load_quantity ?? '',
              assignedTruckNumber: body.decision === 'approved' ? (body.truckNumber ?? '') : '',
              assignedDriverName: body.decision === 'approved' ? (body.driverName ?? '') : '',
              decisionNotes: body.notes ?? '',
              decidedByName,
            },
          },
        })
      } catch (e) {
        console.error('truck-request decision email failed', e)
      }
    }

    return new Response(JSON.stringify({ ok: true, dispatchOrderId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('decide-truck-request error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
