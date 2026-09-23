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

/**
 * Step 8.3 Map Visualization, Interpolation & Destination Types
 */
export interface InterpolatedCoordinate {
  latitude: number;
  longitude: number;
}

export interface MemberLocationRecord extends CurrentLocation {
  movementState: MovementState;
  isStale: boolean;
  isCurrentUser: boolean;
  interpolated?: InterpolatedCoordinate;
}

export interface EventDestination {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  locationName?: string | null;
  isMilestone?: boolean;
  targetTime?: string | null;
  source: 'EVENT_MILESTONE' | 'EVENT' | 'SESSION_DESTINATION';
}

export interface MapBoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
  bounds: [number, number, number, number]; // [west, south, east, north]
}

/**
 * Step 8.4 Valhalla Routing, ETA & Geofence Types
 */
export type RoutingProfile = 'auto' | 'pedestrian' | 'bicycle';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface CalculatedRoute {
  coordinates: [number, number][]; // [lng, lat] GeoJSON LineString coordinates
  distanceMeters: number;
  durationSeconds: number;
  profile: RoutingProfile;
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  calculatedAt: number;
  isStale: boolean;
}

export interface ParticipantEta {
  userId: string;
  distanceMeters: number;
  durationSeconds: number;
  formattedDistance: string;
  formattedEta: string;
  isArrived: boolean;
  isStale: boolean;
  movementState: MovementState;
}

export interface CalculateRouteOptions {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  profile?: RoutingProfile;
  signal?: AbortSignal;
}

export interface RouteCalculationResult {
  route: CalculatedRoute | null;
  error?: string;
}
