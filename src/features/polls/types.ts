/**
 * Neram Instant Polls & Consensus Engine Domain Types
 * Governs group-scoped decision polling, single/multi-choice voting, and consensus results.
 */

export type PollStatus = 'ACTIVE' | 'CLOSED' | 'EXPIRED';

export interface PollOptionRecord {
  id: string;
  pollId: string;
  optionText: string;
  sortOrder: number;
  voteCount: number;
  percentage: number; // 0 to 100, formatted to 1 decimal place or rounded
  isUserVoted: boolean;
  isWinner?: boolean;
}

export interface PollCreator {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
}

export interface PollRecord {
  id: string;
  groupId: string;
  creatorId: string;
  question: string;
  isMultipleChoice: boolean;
  isClosed: boolean;
  closedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  options: PollOptionRecord[];
  totalVotes: number;
  totalVoters: number;
  userVotes: string[]; // option_ids selected by the current user
  hasVoted: boolean;
  isTie?: boolean;
  winningOptionIds: string[];
  creator?: PollCreator;
}

export interface CreatePollInput {
  groupId: string;
  question: string;
  options: string[]; // 2 to 6 non-empty trimmed strings
  isMultipleChoice?: boolean;
  durationHours?: number | null;
  expiresAt?: string | null;
}

export type PollFilterTab = 'ALL' | 'ACTIVE' | 'CLOSED';
export type PollSortOption = 'NEWEST' | 'MOST_VOTES';

export interface VoteMutationResult {
  success: boolean;
  action?: 'VOTED' | 'RETRACTED';
  error?: string;
}

export interface PollMutationResult {
  success: boolean;
  error?: string;
}

export interface FetchPollsResult {
  polls: PollRecord[];
  error?: string;
}

export interface SinglePollResult {
  poll: PollRecord | null;
  error?: string;
}
