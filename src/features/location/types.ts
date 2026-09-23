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

/**
 * Step 8.2 Adaptive Geolocation & Battery Optimization Types
 */
export type MovementState = 'STATIONARY' | 'WALKING' | 'DRIVING' | 'UNKNOWN';

export interface RawPositionFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null; // Speed in m/s
  timestamp: number; // Epoch timestamp in milliseconds
}

export interface TransmissionDecision {
  shouldTransmit: boolean;
  reason: string;
  movementState: MovementState;
  distanceMovedMeters: number;
  elapsedTimeSeconds: number;
}

export interface TransmissionPolicyConfig {
  stationaryDistanceThresholdMeters: number; // default: 25m
  walkingTimeThresholdSeconds: number; // default: 30s
  walkingDistanceThresholdMeters: number; // default: 15m
  drivingTimeThresholdSeconds: number; // default: 10s
  drivingDistanceThresholdMeters: number; // default: 50m
  maxAcceptableAccuracyMeters: number; // default: 65m
  minMovementDetectionMeters: number; // default: 3m (suppress GPS jitter)
}

export interface LocationTrackingState {
  isTracking: boolean;
  movementState: MovementState;
  currentFix: RawPositionFix | null;
  lastTransmittedAt: string | null;
  transmissionCount: number;
  error: string | null;
}
