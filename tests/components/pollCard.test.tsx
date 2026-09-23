import * as React from 'react';
void React;
import { render, fireEvent } from '@testing-library/react-native';
import { PollCard } from '../../src/features/polls/components/PollCard';
import type { PollRecord } from '../../src/features/polls/types';

describe('PollCard Component', () => {
  const basePoll: PollRecord = {
    id: 'poll_1',
    groupId: 'grp_123',
    creatorId: 'user_alice',
    question: 'Select our meeting day',
    isMultipleChoice: false,
    isClosed: false,
    closedAt: null,
    expiresAt: null,
    createdAt: '2026-09-23T10:00:00Z',
    creator: {
      userId: 'user_alice',
      displayName: 'Alice Johnson',
      username: 'alice_j',
      avatarUrl: null,
    },
    options: [
      { id: 'opt_1', pollId: 'poll_1', optionText: 'Friday', sortOrder: 0, voteCount: 4, percentage: 67, isUserVoted: true },
      { id: 'opt_2', pollId: 'poll_1', optionText: 'Saturday', sortOrder: 1, voteCount: 2, percentage: 33, isUserVoted: false },
    ],
    totalVotes: 6,
    totalVoters: 6,
    userVotes: ['opt_1'],
    hasVoted: true,
    winningOptionIds: [],
  };

  it('renders question, creator name, option texts, and percentages', () => {
    const mockVote = jest.fn();
    const { getByText } = render(
      <PollCard poll={basePoll} currentUserId="user_alice" onVote={mockVote} />,
    );

    expect(getByText('Select our meeting day')).toBeTruthy();
    expect(getByText('Alice Johnson')).toBeTruthy();
    expect(getByText('Friday')).toBeTruthy();
    expect(getByText('Saturday')).toBeTruthy();
    expect(getByText('67% (4)')).toBeTruthy();
    expect(getByText('33% (2)')).toBeTruthy();
    expect(getByText('6 votes • 6 members')).toBeTruthy();
  });

  it('fires onVote callback when an option is pressed in active poll', () => {
    const mockVote = jest.fn();
    const { getByTestId } = render(
      <PollCard poll={basePoll} currentUserId="user_other" onVote={mockVote} />,
    );

    fireEvent.press(getByTestId('poll-option-opt_2'));
    expect(mockVote).toHaveBeenCalledWith('poll_1', 'opt_2');
  });

  it('renders Single Choice badge for single-choice polls', () => {
    const { getByText } = render(
      <PollCard poll={basePoll} currentUserId="user_alice" onVote={jest.fn()} />,
    );
    expect(getByText('Single Choice')).toBeTruthy();
  });

  it('renders Multi-Choice badge for multiple-choice polls', () => {
    const multiPoll: PollRecord = {
      ...basePoll,
      isMultipleChoice: true,
    };
    const { getByText } = render(
      <PollCard poll={multiPoll} currentUserId="user_alice" onVote={jest.fn()} />,
    );
    expect(getByText('Multi-Choice')).toBeTruthy();
  });

  it('displays closed badge and consensus winner banner when poll is closed', () => {
    const closedPoll: PollRecord = {
      ...basePoll,
      isClosed: true,
      closedAt: '2026-09-23T12:00:00Z',
      options: [
        { id: 'opt_1', pollId: 'poll_1', optionText: 'Friday', sortOrder: 0, voteCount: 4, percentage: 67, isUserVoted: true, isWinner: true },
        { id: 'opt_2', pollId: 'poll_1', optionText: 'Saturday', sortOrder: 1, voteCount: 2, percentage: 33, isUserVoted: false, isWinner: false },
      ],
      winningOptionIds: ['opt_1'],
    };

    const { getByText } = render(
      <PollCard poll={closedPoll} currentUserId="user_alice" onVote={jest.fn()} />,
    );

    expect(getByText('Closed')).toBeTruthy();
    expect(getByText('Consensus: Friday')).toBeTruthy();
  });

  it('displays tie banner when closed poll has equal top votes', () => {
    const tiePoll: PollRecord = {
      ...basePoll,
      isClosed: true,
      closedAt: '2026-09-23T12:00:00Z',
      isTie: true,
      options: [
        { id: 'opt_1', pollId: 'poll_1', optionText: 'Friday', sortOrder: 0, voteCount: 3, percentage: 50, isUserVoted: true, isWinner: true },
        { id: 'opt_2', pollId: 'poll_1', optionText: 'Saturday', sortOrder: 1, voteCount: 3, percentage: 50, isUserVoted: false, isWinner: true },
      ],
      winningOptionIds: ['opt_1', 'opt_2'],
    };

    const { getByText } = render(
      <PollCard poll={tiePoll} currentUserId="user_alice" onVote={jest.fn()} />,
    );

    expect(getByText('Consensus: Tie between top choices')).toBeTruthy();
  });

  it('shows Close Poll button to creator on active polls', () => {
    const mockClose = jest.fn();
    const { getByTestId } = render(
      <PollCard
        poll={basePoll}
        currentUserId="user_alice"
        onVote={jest.fn()}
        onClosePoll={mockClose}
      />,
    );

    expect(getByTestId('close-poll-button')).toBeTruthy();
  });

  it('hides Close Poll button when user is not the creator', () => {
    const { queryByTestId } = render(
      <PollCard
        poll={basePoll}
        currentUserId="user_other"
        onVote={jest.fn()}
        onClosePoll={jest.fn()}
      />,
    );

    expect(queryByTestId('close-poll-button')).toBeNull();
  });
});
