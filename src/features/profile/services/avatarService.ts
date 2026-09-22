import { supabase } from '../../../lib/supabase';

/**
 * Curated artisanal avatar color themes for users who prefer
 * not to use Google photos or camera uploads.
 */
export interface AvatarPreset {
  id: string;
  name: string;
  backgroundColor: string;
  accentColor: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'indigo', name: 'Indigo Night', backgroundColor: '#312E81', accentColor: '#818CF8' },
  { id: 'teal', name: 'Deep Teal', backgroundColor: '#134E4A', accentColor: '#2DD4BF' },
  { id: 'slate', name: 'Slate Obsidian', backgroundColor: '#1E293B', accentColor: '#94A3B8' },
  { id: 'rose', name: 'Quiet Dusk', backgroundColor: '#881337', accentColor: '#FB7185' },
  { id: 'amber', name: 'Warm Amber', backgroundColor: '#78350F', accentColor: '#FBBF24' },
];

/**
 * Constructs the public CDN URL for an avatar stored in Supabase Storage.
 */
export function getAvatarPublicUrl(avatarPath: string): string {
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }
  const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
  return data.publicUrl;
}

/**
 * Uploads an avatar image buffer or blob into the user's isolated avatar path.
 * Adheres strictly to RLS policy: users can only upload to `${userId}/*`.
 */
export async function uploadAvatar(
  userId: string,
  fileBody: ArrayBuffer | Blob,
  fileExtension = 'jpg',
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const filePath = `${userId}/avatar_${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, fileBody, {
        contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
        upsert: true,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const publicUrl = getAvatarPublicUrl(filePath);
    return { success: true, url: publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload avatar';
    return { success: false, error: message };
  }
}
