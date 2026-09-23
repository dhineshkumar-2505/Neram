/**
 * MapLibre vector map configuration & styling constants for Neram.
 * Follows Obsidian Dark aesthetic with curated neon accent tokens.
 */

export const MAP_CONFIG = {
  /**
   * Free, keyless vector map dark style from OpenFreeMap.
   * Matches Neram's dark obsidian palette.
   */
  STYLE_URL: 'https://tiles.openfreemap.org/styles/dark',

  /**
   * Default camera zooms.
   */
  DEFAULT_ZOOM: 14,
  FOCUS_ME_ZOOM: 16,
  MIN_ZOOM: 2,
  MAX_ZOOM: 18,

  /**
   * Camera animation transition duration in ms.
   */
  CAMERA_ANIMATION_MS: 600,

  /**
   * Linear spherical lerp animation duration in ms.
   */
  INTERPOLATION_DURATION_MS: 300,

  /**
   * Coordinate snap distance threshold in meters.
   * Jumps larger than this snap immediately rather than animating across the globe.
   */
  SNAP_DISTANCE_METERS: 2000,

  /**
   * Location staleness threshold in ms (5 minutes).
   * Data older than this receives subdued styling.
   */
  STALE_THRESHOLD_MS: 5 * 60 * 1000,

  /**
   * Padding in pixels when fitting camera bounds around members and destination.
   */
  FIT_BOUNDS_PADDING: {
    top: 80,
    bottom: 80,
    left: 60,
    right: 60,
  },

  /**
   * Movement state colors.
   */
  MOVEMENT_COLORS: {
    DRIVING: '#06B6D4',    // Cyan
    WALKING: '#10B981',    // Emerald
    STATIONARY: '#F59E0B', // Amber
    STALE: '#6B7280',      // Muted Gray
  },

  /**
   * Destination marker color.
   */
  DESTINATION_COLOR: '#F43F5E', // Rose / Rendezvous

  /**
   * Current user highlight ring color.
   */
  SELF_RING_COLOR: '#38BDF8', // Sky Blue Pulse
} as const;
