import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { fileService } from '../services/fileService';
import type {
  GroupFile,
  UploadFileInput,
  UploadFileResult,
  DeleteFileResult,
  FileFilterTab,
} from '../types';

export interface UseMediaVaultResult {
  allFiles: GroupFile[];
  filteredFiles: GroupFile[];
  activeFilter: FileFilterTab;
  setActiveFilter: (filter: FileFilterTab) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  isUploading: boolean;
  error: string | null;
  counts: {
    all: number;
    images: number;
    documents: number;
  };
  refresh: () => Promise<void>;
  uploadFile: (input: Omit<UploadFileInput, 'groupId'>) => Promise<UploadFileResult>;
  deleteFile: (fileId: string, storagePath?: string) => Promise<DeleteFileResult>;
  getSignedUrl: (storagePath: string, expiresIn?: number) => Promise<string | null>;
}

export function useMediaVault(
  groupId: string | undefined,
  currentUserId?: string,
): UseMediaVaultResult {
  const [allFiles, setAllFiles] = useState<GroupFile[]>([]);
  const [activeFilter, setActiveFilter] = useState<FileFilterTab>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  // Load files from database
  const loadFiles = useCallback(async () => {
    if (!groupId) {
      if (isMountedRef.current) {
        setAllFiles([]);
        setIsLoading(false);
      }
      return;
    }

    try {
      const res = await fileService.listFiles(groupId, currentUserId);
      if (!isMountedRef.current) return;

      if (res.error) {
        setError(res.error);
      } else {
        setAllFiles(res.files);
        setError(null);
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load vault files.';
      setError(message);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [groupId, currentUserId]);

  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    loadFiles();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadFiles]);

  // Realtime subscription setup
  useEffect(() => {
    if (!groupId) return;

    const channelName = `group-files-${groupId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'files',
          filter: `group_id=eq.${groupId}`,
        },
        async (payload) => {
          if (!isMountedRef.current) return;

          if (payload.eventType === 'INSERT') {
            const newFileRes = await fileService.getFile(payload.new.id);
            if (isMountedRef.current && newFileRes.file) {
              setAllFiles((prev) => {
                if (prev.some((f) => f.id === newFileRes.file?.id)) return prev;
                return [newFileRes.file!, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id?: string })?.id;
            if (deletedId) {
              setAllFiles((prev) => prev.filter((f) => f.id !== deletedId));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadFiles();
  }, [loadFiles]);

  // Counts for tabs
  const counts = useMemo(() => {
    let images = 0;
    let documents = 0;

    for (const f of allFiles) {
      if (f.category === 'IMAGE') {
        images++;
      } else {
        documents++;
      }
    }

    return {
      all: allFiles.length,
      images,
      documents,
    };
  }, [allFiles]);

  // Filtered files
  const filteredFiles = useMemo(() => {
    switch (activeFilter) {
      case 'IMAGES':
        return allFiles.filter((f) => f.category === 'IMAGE');
      case 'DOCUMENTS':
        return allFiles.filter((f) => f.category !== 'IMAGE');
      case 'ALL':
      default:
        return allFiles;
    }
  }, [allFiles, activeFilter]);

  const uploadFile = useCallback(
    async (input: Omit<UploadFileInput, 'groupId'>): Promise<UploadFileResult> => {
      if (!groupId || !currentUserId) {
        return { success: false, error: 'Group or authentication missing.' };
      }

      try {
        setIsUploading(true);
        const res = await fileService.uploadFile(
          {
            ...input,
            groupId,
          },
          currentUserId,
        );

        if (res.success && res.file && isMountedRef.current) {
          setAllFiles((prev) => {
            if (prev.some((f) => f.id === res.file?.id)) return prev;
            return [res.file!, ...prev];
          });
        }

        return res;
      } finally {
        if (isMountedRef.current) {
          setIsUploading(false);
        }
      }
    },
    [groupId, currentUserId],
  );

  const deleteFile = useCallback(
    async (fileId: string, storagePath?: string): Promise<DeleteFileResult> => {
      const res = await fileService.deleteFile(fileId, storagePath);
      if (res.success && isMountedRef.current) {
        setAllFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
      return res;
    },
    [],
  );

  const getSignedUrl = useCallback(
    async (storagePath: string, expiresIn?: number): Promise<string | null> => {
      const res = await fileService.getSignedDownloadUrl(storagePath, expiresIn);
      return res.signedUrl;
    },
    [],
  );

  return {
    allFiles,
    filteredFiles,
    activeFilter,
    setActiveFilter,
    isLoading,
    isRefreshing,
    isUploading,
    error,
    counts,
    refresh,
    uploadFile,
    deleteFile,
    getSignedUrl,
  };
}

export default useMediaVault;
