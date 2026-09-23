/**
 * Neram Location Session & Participant Domain Types
 * Governs group-scoped, temporary outing sessions, explicit opt-in participants,
 * and ephemeral current-location fixes.
 */

export type LocationSessionStatus = 'ACTIVE' | 'PAUSED' | 'ARRIVED' | 'ENDED';
export type ParticipantStatus = 'ACTIVE' | 'LEFT' | 'ARRIVED';
export type LocationPermissionState = 'NOT_DETERMINED' | 'GRANTED' | 'DENIED' | 'BLOCKED';

export interface LocationUser {
  userId: string;
  displayName: string;
  username: string;
  avatarPath?: string | null;
}

export interface LocationSession {
  id: string;
  groupId: string;
  createdBy: string;
  title: string;
  destinationName?: string | null;
  destinationLat: number;
  destinationLng: number;
  status: LocationSessionStatus;
  startsAt: string;
  endsAt: string;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  creator?: LocationUser;
  participantsCount?: number;
  isCurrentUserParticipant?: boolean;
}

export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  status: ParticipantStatus;
  joinedAt: string;
  leftAt?: string | null;
  user?: LocationUser;
}

export interface CurrentLocation {
  sessionId: string;
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  recordedAt: string;
  user?: LocationUser;
}

export interface CreateSessionInput {
  groupId: string;
  title?: string;
  destinationName?: string;
  destinationLat: number;
  destinationLng: number;
  durationMinutes?: number; // default 120 (2 hours)
}

export interface LocationSessionResult {
  session: LocationSession | null;
  error?: string;
}

export interface SessionParticipantsResult {
  participants: SessionParticipant[];
  error?: string;
}

export interface CurrentLocationsResult {
  locations: CurrentLocation[];
  error?: string;
}
