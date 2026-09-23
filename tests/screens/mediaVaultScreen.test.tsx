import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { MediaVaultScreen } from '../../src/features/files/screens/MediaVaultScreen';
import * as authHook from '../../src/hooks/useAuth';
import * as vaultHook from '../../src/features/files/hooks/useMediaVault';
import * as lifecycleHook from '../../src/features/groups/hooks/useGroupLifecycle';
import { groupService } from '../../src/features/groups/services/groupService';
import type { GroupFile } from '../../src/features/files/types';
import type { RootStackScreenProps } from '../../src/navigation/types';

jest.mock('../../src/hooks/useAuth');
jest.mock('../../src/features/files/hooks/useMediaVault');
jest.mock('../../src/features/groups/hooks/useGroupLifecycle');
jest.mock('../../src/features/groups/services/groupService');
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('MediaVaultScreen', () => {
  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockNavigation = {
    navigate: mockNavigate,
    goBack: mockGoBack,
  } as unknown as RootStackScreenProps<'MediaVault'>['navigation'];

  const mockRoute = {
    key: 'MediaVault-key',
    name: 'MediaVault' as const,
    params: {
      groupId: 'grp_vault_123',
      groupName: 'Design Sprint Space',
    },
  } as unknown as RootStackScreenProps<'MediaVault'>['route'];

  const mockFiles: GroupFile[] = [
    {
      id: 'file_1',
      groupId: 'grp_vault_123',
      ownerId: 'user_1',
      filename: 'Brief.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      storagePath: 'grp_vault_123/file_1/Brief.pdf',
      category: 'PDF',
      createdAt: '2026-09-23T10:00:00.000Z',
      uploader: {
        userId: 'user_1',
        displayName: 'Alice Lead',
        username: 'alice',
        avatarPath: null,
      },
    },
    {
      id: 'file_2',
      groupId: 'grp_vault_123',
      ownerId: 'user_2',
      filename: 'Mockup.png',
      mimeType: 'image/png',
      sizeBytes: 2097152,
      storagePath: 'grp_vault_123/file_2/Mockup.png',
      category: 'IMAGE',
      createdAt: '2026-09-23T11:00:00.000Z',
      uploader: {
        userId: 'user_2',
        displayName: 'Bob Designer',
        username: 'bob',
        avatarPath: null,
      },
    },
  ];

  const mockRefresh = jest.fn();
  const mockUploadFile = jest.fn();
  const mockDeleteFile = jest.fn();
  const mockGetSignedUrl = jest.fn();
  const mockSetActiveFilter = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (authHook.useAuth as jest.Mock).mockReturnValue({
      user: { id: 'user_1', email: 'alice@test.com' },
      session: { user: { id: 'user_1' } },
    });

    (groupService.fetchGroupDetails as jest.Mock).mockResolvedValue({
      group: {
        id: 'grp_vault_123',
        name: 'Design Sprint Space',
        starts_at: '2026-09-23T00:00:00Z',
        expires_at: '2026-09-30T00:00:00Z',
        lifecycle_state: 'ACTIVE',
      },
    });

    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      remainingTime: {
        formattedText: '6d 12h remaining',
      },
      isExpired: false,
    });

    (vaultHook.useMediaVault as jest.Mock).mockReturnValue({
      allFiles: mockFiles,
      filteredFiles: mockFiles,
      activeFilter: 'ALL',
      setActiveFilter: mockSetActiveFilter,
      isLoading: false,
      isRefreshing: false,
      isUploading: false,
      error: null,
      counts: {
        all: 2,
        images: 1,
        documents: 1,
      },
      refresh: mockRefresh,
      uploadFile: mockUploadFile,
      deleteFile: mockDeleteFile,
      getSignedUrl: mockGetSignedUrl,
    });
  });

  it('renders header with space title, remaining time badge, and filter tabs', async () => {
    const { getByText, findByText, getByTestId } = render(
      <MediaVaultScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Design Sprint Space')).toBeTruthy();
    expect(getByText('Media Vault')).toBeTruthy();
    expect(getByText('6d 12h remaining')).toBeTruthy();

    expect(getByTestId('tab-all')).toBeTruthy();
    expect(getByTestId('tab-images')).toBeTruthy();
    expect(getByTestId('tab-documents')).toBeTruthy();
  });

  it('navigates back when back button is pressed', async () => {
    const { findByText, getByTestId } = render(
      <MediaVaultScreen route={mockRoute} navigation={mockNavigation} />,
    );

    await findByText('Design Sprint Space');
    fireEvent.press(getByTestId('media-vault-back-button'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('calls setActiveFilter when tabs are pressed', async () => {
    const { findByText, getByTestId } = render(
      <MediaVaultScreen route={mockRoute} navigation={mockNavigation} />,
    );

    await findByText('Design Sprint Space');
    fireEvent.press(getByTestId('tab-images'));
    expect(mockSetActiveFilter).toHaveBeenCalledWith('IMAGES');

    fireEvent.press(getByTestId('tab-documents'));
    expect(mockSetActiveFilter).toHaveBeenCalledWith('DOCUMENTS');
  });

  it('renders files in the list', async () => {
    const { findByText } = render(
      <MediaVaultScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Brief.pdf')).toBeTruthy();
    expect(await findByText('Mockup.png')).toBeTruthy();
  });

  it('shows read-only banner and hides upload FAB when space is expired', async () => {
    (lifecycleHook.useGroupLifecycle as jest.Mock).mockReturnValue({
      remainingTime: 'EXPIRED',
      isExpired: true,
    });

    const { findByText, queryByTestId } = render(
      <MediaVaultScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(
      await findByText(
        'SPACE DISSOLVED — Media Vault is frozen in permanent read-only archive mode.',
      ),
    ).toBeTruthy();
    expect(queryByTestId('upload-file-fab')).toBeNull();
  });

  it('renders empty state when vault has no files', async () => {
    (vaultHook.useMediaVault as jest.Mock).mockReturnValue({
      allFiles: [],
      filteredFiles: [],
      activeFilter: 'ALL',
      setActiveFilter: mockSetActiveFilter,
      isLoading: false,
      isRefreshing: false,
      isUploading: false,
      error: null,
      counts: { all: 0, images: 0, documents: 0 },
      refresh: mockRefresh,
      uploadFile: mockUploadFile,
      deleteFile: mockDeleteFile,
      getSignedUrl: mockGetSignedUrl,
    });

    const { findByText } = render(
      <MediaVaultScreen route={mockRoute} navigation={mockNavigation} />,
    );

    expect(await findByText('Media Vault is Empty')).toBeTruthy();
    expect(
      await findByText(
        'No private documents or media attachments have been uploaded to this temporary space yet.',
      ),
    ).toBeTruthy();
  });
});
