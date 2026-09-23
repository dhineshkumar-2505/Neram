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

// Hooks
export { useLocationSession } from './hooks/useLocationSession';
export type { UseLocationSessionResult } from './hooks/useLocationSession';
export { useLocationTracking } from './hooks/useLocationTracking';

// Components
export { LocationOptInModal } from './components/LocationOptInModal';
export type { LocationOptInModalProps } from './components/LocationOptInModal';
export { CreateSessionModal } from './components/CreateSessionModal';
export type { CreateSessionModalProps } from './components/CreateSessionModal';
export * from './components/LocationIcons';

// Screens
import { LocationSessionScreen } from './screens/LocationSessionScreen';
export { LocationSessionScreen };
export default LocationSessionScreen;
