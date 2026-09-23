/**
 * Valhalla Routing & Geofence configuration for Neram.
 * Follows Obsidian Dark aesthetic tokens and privacy-preserving arrival policies.
 */

export const ROUTING_CONFIG = {
  /**
   * Base Valhalla routing service endpoint.
   * Defaults to public OpenStreetMap Germany / FOSSGIS routing instance.
   * Can be overridden via environment variable EXPO_PUBLIC_VALHALLA_BASE_URL.
   */
  VALHALLA_BASE_URL:
    process.env.EXPO_PUBLIC_VALHALLA_BASE_URL ||
    'https://valhalla1.openstreetmap.de/route',

  /**
   * Maximum duration in milliseconds before a route request is aborted.
   */
  REQUEST_TIMEOUT_MS: 8000,

  /**
   * Maximum retry attempts on transient network or server errors.
   */
  MAX_RETRIES: 2,

  /**
   * Delay between retries in milliseconds.
   */
  RETRY_DELAY_MS: 1500,

  /**
   * Physical distance threshold in meters for destination arrival.
   * Evaluated strictly via geodesic (Haversine) calculation, NOT road distance.
   */
  GEOFENCE_RADIUS_METERS: 50,

  /**
   * Maximum acceptable GPS accuracy (in meters) to allow geofence arrival.
   * Prevents cellular tower fallbacks (e.g., accuracy 300m) from triggering false arrival.
   */
  GEOFENCE_MAX_ACCURACY_METERS: 65,

  /**
   * Minimum physical displacement in meters from last route origin
   * required to trigger a recalculation request.
   */
  ROUTE_MIN_DISPLACEMENT_METERS: 35,

  /**
   * Duration in milliseconds after which an active route is considered stale (90s).
   */
  ROUTE_STALE_DURATION_MS: 90000,

  /**
   * Valhalla costing profiles mapped to Neram movement states.
   */
  PROFILES: {
    DRIVING: 'auto',
    WALKING: 'pedestrian',
    BICYCLE: 'bicycle',
    DEFAULT: 'auto',
  } as const,

  /**
   * Route polyline line styling tokens.
   */
  STYLE: {
    LINE_COLOR: '#38BDF8', // Cyan / Sky Blue
    LINE_WIDTH: 4.5,
    LINE_OPACITY: 0.85,
  } as const,
} as const;
