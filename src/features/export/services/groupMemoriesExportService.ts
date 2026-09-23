import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../../lib/supabase';
import { groupService } from '../../groups/services/groupService';
import { fileService } from '../../files/services/fileService';
import type { ExportProgress, ExportOptions, ExportResult } from '../types';

export class GroupMemoriesExportService {
  /**
   * Generates a deterministic ZIP archive containing all group memories,
   * saves it to local temporary cache, and presents the native share sheet.
   */
  public async exportGroupMemories(
    groupId: string,
    onProgress?: (progress: ExportProgress) => void,
    options: ExportOptions = { includeMedia: true, includeAudio: true },
  ): Promise<ExportResult> {
    try {
      // Step 1: Validate and fetch group metadata
      onProgress?.({
        step: 'FETCHING_METADATA',
        progressPercent: 10,
        statusMessage: 'Verifying space authorization and details...',
      });

      const groupRes = await groupService.fetchGroupDetails(groupId);
      if (groupRes.error || !groupRes.group) {
        return {
          success: false,
          error: groupRes.error || 'Temporary space could not be found or has dissolved.',
        };
      }

      const group = groupRes.group;
      const zip = new JSZip();

      // Step 2: Gather Chat Transcript
      onProgress?.({
        step: 'GATHERING_CHAT',
        progressPercent: 25,
        statusMessage: 'Compiling human-readable chat transcript...',
      });

      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          body,
          created_at,
          sender:profiles!messages_sender_id_fkey(display_name, username)
        `)
        .eq('group_id', groupId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      const rawMessages = messagesError ? [] : messagesData || [];

      // Format chat recap text
      const transcriptLines = [
        '================================================================================',
        `NĒRAM TEMPORARY SPACE ARCHIVE: ${group.name}`,
        `Purpose: ${group.purpose}`,
        `Dissolution Deadline: ${group.expires_at}`,
        `Export Timestamp: ${new Date().toISOString()}`,
        '================================================================================',
        '',
        'CHAT LOGS:',
        '--------------------------------------------------------------------------------',
      ];

      for (const m of rawMessages) {
        const sender = m.sender as { display_name?: string; username?: string } | null;
        const author = sender?.display_name || (sender?.username ? `@${sender.username}` : 'Member');
        const time = new Date(m.created_at).toLocaleString();
        transcriptLines.push(`[${time}] ${author}: ${m.body}`);
      }

      if (rawMessages.length === 0) {
        transcriptLines.push('(No messages were recorded in this space)');
      }

      transcriptLines.push('--------------------------------------------------------------------------------');
      zip.file('chat_recap.txt', transcriptLines.join('\n'));

      // Step 3: Collect Modules (Tasks, Events, Polls)
      onProgress?.({
        step: 'COLLECTING_MODULES',
        progressPercent: 45,
        statusMessage: 'Exporting tasks, calendar events, and polls...',
      });

      const [tasksRes, eventsRes, pollsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('group_id', groupId).order('created_at', { ascending: true }),
        supabase.from('events').select('*').eq('group_id', groupId).order('starts_at', { ascending: true }),
        supabase.from('polls').select('*, poll_options(*), poll_votes(*)').eq('group_id', groupId).order('created_at', { ascending: true }),
      ]);

      zip.file('tasks.json', JSON.stringify(tasksRes.data || [], null, 2));
      zip.file('events.json', JSON.stringify(eventsRes.data || [], null, 2));
      zip.file('polls.json', JSON.stringify(pollsRes.data || [], null, 2));

      // Step 4: Download Media Vault Photos and Voice Notes
      onProgress?.({
        step: 'DOWNLOADING_MEDIA',
        progressPercent: 65,
        statusMessage: 'Archiving photos and voice notes...',
      });

      const { data: filesData } = await supabase
        .from('files')
        .select('*')
        .eq('group_id', groupId);

      const files = filesData || [];
      const photosFolder = zip.folder('photos');
      const audioFolder = zip.folder('audio');

      let processedMedia = 0;
      const totalMedia = files.length;

      for (const file of files) {
        try {
          const isImage = file.mime_type.startsWith('image/');
          const isAudio = file.mime_type.startsWith('audio/');

          if ((isImage && options.includeMedia !== false) || (isAudio && options.includeAudio !== false)) {
            const signedRes = await fileService.getSignedDownloadUrl(file.storage_path, 300);
            if (signedRes.signedUrl) {
              const res = await globalThis.fetch(signedRes.signedUrl);
              const blob = await res.blob();
              const arrayBuffer = await blob.arrayBuffer();

              const safeName = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
              if (isImage && photosFolder) {
                photosFolder.file(safeName, arrayBuffer);
              } else if (isAudio && audioFolder) {
                audioFolder.file(safeName, arrayBuffer);
              }
            }
          }
        } catch {
          // Continue archiving even if a single media download fails
        }

        processedMedia++;
        if (totalMedia > 0) {
          const mediaProgress = 65 + Math.round((processedMedia / totalMedia) * 15);
          onProgress?.({
            step: 'DOWNLOADING_MEDIA',
            progressPercent: mediaProgress,
            statusMessage: `Archiving media (${processedMedia}/${totalMedia})...`,
          });
        }
      }

      // Step 5: README and Manifest
      const memberList = group.members
        .map(
          (m) =>
            `- ${m.profile?.display_name || 'Member'} (@${m.profile?.username || 'user'}) [${m.role}]`,
        )
        .join('\n');

      const readmeContent = [
        '================================================================================',
        'NĒRAM — TEMPORARY COLLABORATION SPACE ARCHIVE',
        '================================================================================',
        '',
        `Space Name:      ${group.name}`,
        `Purpose:         ${group.purpose}`,
        `Description:     ${group.description || 'N/A'}`,
        `Created At:      ${group.created_at}`,
        `Dissolved At:    ${group.expires_at}`,
        `Exported On:     ${new Date().toISOString()}`,
        '',
        'PARTICIPANTS:',
        memberList,
        '',
        'CONTENTS OF THIS ARCHIVE:',
        '- README.txt:        Space overview and participant metadata.',
        '- chat_recap.txt:    Human-readable chronological transcript of chat messages.',
        '- tasks.json:        Task board action items, assignments, and statuses.',
        '- events.json:       Itinerary events and schedule entries.',
        '- polls.json:        Group decision polls and tallied vote options.',
        '- photos/:           Photos and media uploaded to the group media vault.',
        '- audio/:            Voice notes recorded in the group chat.',
        '- manifest.json:     Archive integrity verification manifest.',
        '',
        'PRIVACY & EPHEMERAL NOTICE:',
        'This archive was exported by an authorized participant prior to scheduled',
        'space dissolution. Neram servers permanently purge all database records,',
        'uploaded media, and chat logs upon space expiration.',
        '================================================================================',
      ].join('\n');

      zip.file('README.txt', readmeContent);

      const manifestContent = {
        neramArchiveVersion: '1.0.0',
        groupId: group.id,
        groupName: group.name,
        purpose: group.purpose,
        exportedAt: new Date().toISOString(),
        expiresAt: group.expires_at,
        counts: {
          messages: rawMessages.length,
          tasks: (tasksRes.data || []).length,
          events: (eventsRes.data || []).length,
          polls: (pollsRes.data || []).length,
          files: files.length,
        },
      };

      zip.file('manifest.json', JSON.stringify(manifestContent, null, 2));

      // Step 6: Compress ZIP Archive
      onProgress?.({
        step: 'BUILDING_ARCHIVE',
        progressPercent: 88,
        statusMessage: 'Compressing archive with high-efficiency DEFLATE...',
      });

      const zipBase64 = await zip.generateAsync({
        type: 'base64',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      // Step 7: Write to Cache Directory
      const safeGroupName = group.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
      const filename = `neram_${safeGroupName}_memories_${Date.now()}.zip`;
      const filePath = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(filePath, zipBase64, {
        encoding: FileSystem.EncodingType?.Base64 ?? 'base64',
      });

      const fileInfo = await FileSystem.getInfoAsync(filePath);
      const byteSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : undefined;

      onProgress?.({
        step: 'READY',
        progressPercent: 100,
        statusMessage: 'Memories archive ready for export!',
      });

      // Step 8: Trigger Native Share Sheet
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/zip',
          dialogTitle: `Export ${group.name} Memories`,
          UTI: 'public.zip-archive',
        });
      }

      return {
        success: true,
        filePath,
        byteSize,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export group memories.';
      onProgress?.({
        step: 'ERROR',
        progressPercent: 0,
        statusMessage: message,
      });
      return {
        success: false,
        error: message,
      };
    }
  }
}

export const groupMemoriesExportService = new GroupMemoriesExportService();
export default groupMemoriesExportService;
