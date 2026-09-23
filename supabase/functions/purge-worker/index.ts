import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaimedGroup {
  group_id: string;
  group_name: string;
  owner_id: string;
  file_storage_paths: string[];
}

/**
 * Neram Scheduled Purge Worker Edge Function.
 * Runs in a secure server-side Deno runtime using service-role credentials.
 * 1. Atomically claims candidate groups using public.claim_groups_for_dissolution (SKIP LOCKED).
 * 2. Purges binary assets from Supabase Storage buckets ('attachments', 'group-media').
 * 3. Authoritatively scrubs collaboration data via public.execute_group_database_purge.
 * 4. Records partial failures safely with retry tracking via public.record_group_cleanup_failure.
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

    // 1. Claim candidate groups needing dissolution (atomic & concurrency-safe)
    const { data: claimedGroups, error: claimError } = await supabase.rpc('claim_groups_for_dissolution', {
      p_limit: 5,
    });

    if (claimError) {
      console.error('[purge-worker] Error claiming groups for dissolution:', claimError);
      return new Response(JSON.stringify({ error: claimError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groups: ClaimedGroup[] = (claimedGroups as ClaimedGroup[]) || [];
    console.log(`[purge-worker] Claimed ${groups.length} group(s) for dissolution.`);

    let purgedCount = 0;
    let failedCount = 0;
    const results: Array<{ groupId: string; status: 'PURGED' | 'FAILED'; error?: string }> = [];

    // 2. Process each claimed group
    for (const group of groups) {
      try {
        console.log(`[purge-worker] Purging storage objects for group: ${group.group_id} (${group.group_name})`);

        // A. Purge group-media objects ({group_id}/*)
        const { data: mediaFiles, error: mediaListErr } = await supabase.storage
          .from('group-media')
          .list(group.group_id);

        if (!mediaListErr && mediaFiles && mediaFiles.length > 0) {
          const mediaPaths = mediaFiles.map((f: { name: string }) => `${group.group_id}/${f.name}`);
          const { error: mediaRemoveErr } = await supabase.storage.from('group-media').remove(mediaPaths);
          if (mediaRemoveErr) {
            console.warn(`[purge-worker] Warning removing group-media for ${group.group_id}:`, mediaRemoveErr.message);
          }
        }

        // B. Purge attachments objects ({group_id}/*)
        const { data: attachmentFiles, error: attachListErr } = await supabase.storage
          .from('attachments')
          .list(group.group_id);

        if (!attachListErr && attachmentFiles && attachmentFiles.length > 0) {
          const attachPaths = attachmentFiles.map((f: { name: string }) => `${group.group_id}/${f.name}`);
          const { error: attachRemoveErr } = await supabase.storage.from('attachments').remove(attachPaths);
          if (attachRemoveErr) {
            console.warn(`[purge-worker] Warning removing attachments for ${group.group_id}:`, attachRemoveErr.message);
          }
        }

        // C. Explicitly remove any paths returned by files metadata
        if (group.file_storage_paths && group.file_storage_paths.length > 0) {
          await supabase.storage.from('attachments').remove(group.file_storage_paths);
          await supabase.storage.from('group-media').remove(group.file_storage_paths);
        }

        // D. Authoritatively purge database collaboration records
        const { error: dbPurgeError } = await supabase.rpc('execute_group_database_purge', {
          p_group_id: group.group_id,
        });

        if (dbPurgeError) {
          throw new Error(`Database purge failed: ${dbPurgeError.message}`);
        }

        purgedCount++;
        results.push({ groupId: group.group_id, status: 'PURGED' });
        console.log(`[purge-worker] Successfully purged group ${group.group_id}`);
      } catch (groupError) {
        failedCount++;
        const errorMessage = groupError instanceof Error ? groupError.message : 'Unknown group purge failure';
        console.error(`[purge-worker] Failed to purge group ${group.group_id}:`, errorMessage);

        // Record failure in DB for safe retry
        await supabase.rpc('record_group_cleanup_failure', {
          p_group_id: group.group_id,
          p_error_message: errorMessage,
        });

        results.push({ groupId: group.group_id, status: 'FAILED', error: errorMessage });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        claimed: groups.length,
        purged: purgedCount,
        failed: failedCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown purge worker error';
    console.error('[purge-worker] Uncaught failure:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
