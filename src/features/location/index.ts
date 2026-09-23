// Types
export * from './types';

// Utils & Geometry
export * from './utils/geoUtils';

// Services & Engines
export { locationSessionService } from './services/locationSessionService';
export { locationPermissionService } from './services/locationPermissionService';
export { movementEngine, MovementEngine } from './services/movementEngine';
export {
  locationTransmissionPolicy,
  LocationTransmissionPolicy,
  DEFAULT_TRANSMISSION_CONFIG,
} from './services/locationTransmissionPolicy';
export { locationEngine, LocationEngine } from './services/locationEngine';
export { routingService, RoutingService } from './services/routingService';

// Config
export { MAP_CONFIG } from './config/mapConfig';
export { ROUTING_CONFIG } from './config/routingConfig';

// Hooks
export { useLocationSession } from './hooks/useLocationSession';
export type { UseLocationSessionResult } from './hooks/useLocationSession';
export { useLocationTracking } from './hooks/useLocationTracking';
export { useRealtimeLocations } from './hooks/useRealtimeLocations';
export type { UseRealtimeLocationsResult } from './hooks/useRealtimeLocations';
export { useEventDestination } from './hooks/useEventDestination';
export type { UseEventDestinationResult } from './hooks/useEventDestination';
export { useValhallaRoute } from './hooks/useValhallaRoute';
export type { UseValhallaRouteOptions, UseValhallaRouteResult } from './hooks/useValhallaRoute';
export { useGeofenceArrival } from './hooks/useGeofenceArrival';
export type { UseGeofenceArrivalOptions, UseGeofenceArrivalResult } from './hooks/useGeofenceArrival';

// Utils
export { decodePolyline } from './utils/polylineDecoder';
export { formatDurationEta, formatRoadDistance, formatArrivalTime } from './utils/formatEta';
export { interpolateCoordinate, shouldSnapDistance } from './utils/interpolateLocation';
export { isLocationStale, formatLocationAge, formatSpeedKmh } from './utils/locationFreshness';
export { calculateCoordinatesBounds } from './utils/mapBounds';

// Components
export { LocationOptInModal } from './components/LocationOptInModal';
export type { LocationOptInModalProps } from './components/LocationOptInModal';
export { CreateSessionModal } from './components/CreateSessionModal';
export type { CreateSessionModalProps } from './components/CreateSessionModal';
export { MemberLocationMarker } from './components/MemberLocationMarker';
export type { MemberLocationMarkerProps } from './components/MemberLocationMarker';
export { DestinationMarker } from './components/DestinationMarker';
export type { DestinationMarkerProps } from './components/DestinationMarker';
export { LocationMapControls } from './components/LocationMapControls';
export type { LocationMapControlsProps } from './components/LocationMapControls';
export { LocationMap } from './components/LocationMap';
export type { LocationMapProps } from './components/LocationMap';
export * from './components/LocationIcons';

// Screens
import { LocationSessionScreen } from './screens/LocationSessionScreen';
export { LocationSessionScreen };
export default LocationSessionScreen;
