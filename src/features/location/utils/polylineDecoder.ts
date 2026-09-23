import { isValidCoordinate } from './geoUtils';

/**
 * Decodes a Valhalla precision-6 (1e6) or standard precision-5 (1e5) encoded polyline string
 * into an array of GeoJSON LineString coordinates: [longitude, latitude].
 *
 * @param encoded The polyline string to decode.
 * @param precision Precision factor (default 6 for Valhalla, 1e6).
 * @returns Array of [longitude, latitude] coordinate pairs.
 */
export function decodePolyline(
  encoded?: string | null,
  precision: number = 6,
): [number, number][] {
  if (!encoded || typeof encoded !== 'string' || !encoded.trim()) {
    return [];
  }

  const factor = Math.pow(10, precision);
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  try {
    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;

      // Decode latitude
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < encoded.length);

      const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      // Decode longitude
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < encoded.length);

      const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      const currentLat = Number((lat / factor).toFixed(7));
      const currentLng = Number((lng / factor).toFixed(7));

      if (isValidCoordinate(currentLat, currentLng)) {
        coordinates.push([currentLng, currentLat]);
      }
    }
  } catch {
    // If the polyline string is malformed or truncated, return whatever valid points were decoded
    return coordinates;
  }

  return coordinates;
}
