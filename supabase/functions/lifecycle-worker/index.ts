import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Neram Scheduled Lifecycle Worker Edge Function.
 * Executed every 60 seconds via pg_cron or HTTP webhook.
 * Invokes public.process_group_lifecycle_transitions() to transition expired groups,
 * close active location sessions, and emit member dissolution notifications.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Execute server-authoritative state transitions
    const { data, error } = await supabase.rpc('process_group_lifecycle_transitions');

    if (error) {
      console.error('[lifecycle-worker] Error executing transitions:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[lifecycle-worker] Successfully executed transitions:', data);

    return new Response(
      JSON.stringify({
        success: true,
        metrics: data,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown lifecycle worker error';
    console.error('[lifecycle-worker] Uncaught failure:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
