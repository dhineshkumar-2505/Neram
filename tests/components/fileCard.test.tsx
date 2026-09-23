import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FileCard } from '../../src/features/files/components/FileCard';
import type { GroupFile } from '../../src/features/files/types';

describe('FileCard Component', () => {
  const baseFile: GroupFile = {
    id: 'file_1',
    groupId: 'grp_123',
    ownerId: 'user_alice',
    filename: 'Quarterly_Report_2026.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1572864, // ~1.5 MB
    storagePath: 'grp_123/file_1/Quarterly_Report_2026.pdf',
    category: 'PDF',
    createdAt: '2026-09-23T10:00:00Z',
    uploader: {
      userId: 'user_alice',
      displayName: 'Alice Johnson',
      username: 'alice_j',
      avatarPath: null,
    },
  };

  it('renders filename, size badge, and uploader username correctly', () => {
    const mockOpen = jest.fn();
    const { getByText } = render(
      <FileCard
        file={baseFile}
        currentUserId="user_alice"
        onOpen={mockOpen}
      />,
    );

    expect(getByText('Quarterly_Report_2026.pdf')).toBeTruthy();
    expect(getByText('1.5 MB')).toBeTruthy();
    expect(getByText('@alice_j')).toBeTruthy();
  });

  it('calls onOpen when download/open button is pressed', () => {
    const mockOpen = jest.fn();
    const { getByLabelText } = render(
      <FileCard
        file={baseFile}
        currentUserId="user_alice"
        onOpen={mockOpen}
      />,
    );

    fireEvent.press(getByLabelText('Download or View File'));
    expect(mockOpen).toHaveBeenCalledWith(baseFile);
  });

  it('shows delete confirmation alert when owner presses delete button', () => {
    const mockDelete = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByLabelText } = render(
      <FileCard
        file={baseFile}
        currentUserId="user_alice"
        onOpen={jest.fn()}
        onDelete={mockDelete}
      />,
    );

    fireEvent.press(getByLabelText('Delete File'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Attachment',
      expect.stringContaining('Quarterly_Report_2026.pdf'),
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });

  it('does not render delete button if the space is expired', () => {
    const { queryByLabelText } = render(
      <FileCard
        file={baseFile}
        currentUserId="user_alice"
        isExpired={true}
        onOpen={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(queryByLabelText('Delete File')).toBeNull();
  });
});
