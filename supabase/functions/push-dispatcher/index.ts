import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  actor_id?: string | null;
  group_id?: string | null;
  payload_json?: Record<string, unknown> | null;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'MessageTooBig' | 'MessageRateExceeded' | 'InvalidCredentials';
  };
}

/**
 * Formats user-friendly titles and message bodies based on the notification type.
 */
function formatNotificationContent(
  type: string,
  payload: Record<string, unknown>,
  groupName: string,
): { title: string; body: string } {
  switch (type) {
    case 'TASK_ASSIGNED':
      return {
        title: '📋 Task Assigned',
        body: payload.task_title
          ? `"${payload.task_title}" in ${groupName}`
          : `You were assigned a task in ${groupName}`,
      };
    case 'GROUP_INVITE':
      return {
        title: '🎟️ Group Invitation',
        body: `You were invited to join "${groupName}"`,
      };
    case 'EVENT_REMINDER':
      return {
        title: `📅 Event: ${payload.event_title ?? 'Upcoming Event'}`,
        body: `${groupName} • Tap to view itinerary`,
      };
    case 'GROUP_EXPIRING':
      return {
        title: '⏳ Group Expiring Soon',
        body: `"${groupName}" is dissolving soon. Save any notes before expiry!`,
      };
    case 'GROUP_EXPIRED':
      return {
        title: '💨 Group Dissolved',
        body: `"${groupName}" has expired and its temporary data has been purged.`,
      };
    case 'FILE_UPLOADED':
      return {
        title: '📁 File Shared',
        body: `"${payload.filename ?? 'New file'}" added to ${groupName}`,
      };
    case 'FRIEND_REQUEST':
      return {
        title: '🤝 Friend Request',
        body: 'Someone sent you a friend request on Neram.',
      };
    case 'FRIEND_ACCEPTED':
      return {
        title: '🎉 Friend Request Accepted',
        body: 'You are now connected on Neram.',
      };
    case 'MESSAGE_MENTION':
      return {
        title: `💬 Mentioned in ${groupName}`,
        body: `${payload.sender_name ?? 'A member'}: ${payload.preview ?? 'Mentioned you in chat'}`,
      };
    default:
      return {
        title: 'Neram Notification',
        body: 'You have a new update in your group.',
      };
  }
}

/**
 * Neram Push Dispatcher Edge Function.
 * Receives notification event payloads, fetches active device tokens for recipient,
 * batches dispatch to Expo Push Gateway, and prunes stale unregistered tokens.
 */
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    // Support either direct record or webhook { record: { ... } } structure
    const record: NotificationRecord = body.record || body;

    if (!record || !record.user_id) {
      return new Response(JSON.stringify({ error: 'Missing notification record or user_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch recipient's active push tokens
    const { data: devices, error: deviceError } = await supabase
      .from('user_devices')
      .select('device_id, push_token')
      .eq('user_id', record.user_id);

    if (deviceError) {
      throw new Error(`Failed to query user devices: ${deviceError.message}`);
    }

    const validDevices = (devices || []).filter(
      (d: { push_token?: string }) => d.push_token && d.push_token.startsWith('ExponentPushToken'),
    );

    if (validDevices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active Expo push tokens found for recipient.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Fetch group name if scoped to a group
    let groupName = 'Neram Group';
    if (record.group_id) {
      const { data: groupData } = await supabase
        .from('groups')
        .select('name')
        .eq('id', record.group_id)
        .maybeSingle();

      if (groupData?.name) {
        groupName = groupData.name;
      }
    }

    // 3. Format message content
    const payload = record.payload_json || {};
    const { title, body: messageBody } = formatNotificationContent(record.type, payload, groupName);

    // 4. Construct Expo push messages
    const messages = validDevices.map((d: { push_token: string }) => ({
      to: d.push_token,
      sound: 'default',
      title,
      body: messageBody,
      data: {
        notificationId: record.id,
        groupId: record.group_id,
        type: record.type,
      },
      channelId: 'neram-default',
      priority: 'high',
    }));

    // 5. Send batch to Expo Push Gateway
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoResult = await expoResponse.json();
    const tickets: ExpoPushTicket[] = expoResult.data || [];

    // 6. Automatically prune stale tokens if DeviceNotRegistered
    const staleDeviceIds: string[] = [];
    tickets.forEach((ticket, idx) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const device = validDevices[idx];
        if (device?.device_id) {
          staleDeviceIds.push(device.device_id);
        }
      }
    });

    if (staleDeviceIds.length > 0) {
      console.log(`[push-dispatcher] Pruning ${staleDeviceIds.length} stale device(s):`, staleDeviceIds);
      await supabase.from('user_devices').delete().in('device_id', staleDeviceIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: messages.length,
        prunedStaleTokens: staleDeviceIds.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown push dispatcher error';
    console.error('[push-dispatcher] Error:', errorMsg);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
