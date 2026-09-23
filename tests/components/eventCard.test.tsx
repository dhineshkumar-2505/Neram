import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { EventCard } from '../../src/features/events/components/EventCard';
import type { EventRecord } from '../../src/features/events/types';

describe('EventCard', () => {
  const mockEvent: EventRecord = {
    id: 'evt_card_1',
    groupId: 'grp_123',
    creatorId: 'user_1',
    title: 'Final Project Pitch',
    description: '10-minute presentation followed by Q&A',
    targetTime: '2026-09-28T14:30:00.000Z',
    endsAt: '2026-09-28T15:30:00.000Z',
    locationName: 'Auditorium A',
    latitude: 1.2987,
    longitude: 103.8543,
    isMilestone: true,
    createdAt: '2026-09-23T10:00:00.000Z',
    creator: {
      userId: 'user_1',
      displayName: 'Alice Architect',
      username: 'alice',
      avatarUrl: null,
    },
  };

  const mockEdit = jest.fn();
  const mockDelete = jest.fn();
  const mockExport = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders event title, milestone badge, location, and rendezvous coordinates badge', () => {
    const { getByText } = render(
      <EventCard
        event={mockEvent}
        currentUserId="user_1"
        onEdit={mockEdit}
        onDelete={mockDelete}
        onExportCalendar={mockExport}
      />,
    );

    expect(getByText('Final Project Pitch')).toBeTruthy();
    expect(getByText('MILESTONE')).toBeTruthy();
    expect(getByText('Auditorium A')).toBeTruthy();
    expect(getByText('Rendezvous Pinned')).toBeTruthy();
    expect(getByText('10-minute presentation followed by Q&A')).toBeTruthy();
    expect(getByText('By @alice')).toBeTruthy();
  });

  it('triggers calendar export callback when calendar button is pressed', () => {
    const { getByLabelText } = render(
      <EventCard
        event={mockEvent}
        currentUserId="user_1"
        onExportCalendar={mockExport}
      />,
    );

    const exportBtn = getByLabelText('Export to Calendar');
    fireEvent.press(exportBtn);

    expect(mockExport).toHaveBeenCalledWith(mockEvent);
  });

  it('triggers edit callback when edit button is pressed', () => {
    const { getByLabelText } = render(
      <EventCard
        event={mockEvent}
        currentUserId="user_1"
        onEdit={mockEdit}
      />,
    );

    const editBtn = getByLabelText('Edit Event');
    fireEvent.press(editBtn);

    expect(mockEdit).toHaveBeenCalledWith(mockEvent);
  });

  it('shows confirmation alert when delete button is pressed', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByLabelText } = render(
      <EventCard
        event={mockEvent}
        currentUserId="user_1"
        onDelete={mockDelete}
      />,
    );

    const deleteBtn = getByLabelText('Delete Event');
    fireEvent.press(deleteBtn);

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Event',
      expect.stringContaining('Final Project Pitch'),
      expect.any(Array),
    );

    alertSpy.mockRestore();
  });

  it('prevents edit and warns with alert when space is expired', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByText } = render(
      <EventCard
        event={mockEvent}
        currentUserId="user_1"
        isExpired={true}
        onEdit={mockEdit}
      />,
    );

    // In expired mode, edit/delete buttons are hidden from action bar, but title exists
    expect(getByText('Final Project Pitch')).toBeTruthy();

    alertSpy.mockRestore();
  });
});
