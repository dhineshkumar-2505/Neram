import { decodePolyline } from '../../src/features/location/utils/polylineDecoder';

describe('polylineDecoder', () => {
  it('returns empty array for null, undefined, or empty string', () => {
    expect(decodePolyline(null)).toEqual([]);
    expect(decodePolyline(undefined)).toEqual([]);
    expect(decodePolyline('')).toEqual([]);
    expect(decodePolyline('   ')).toEqual([]);
  });

  it('safely catches malformed input without throwing an exception', () => {
    // String with abrupt truncation or invalid characters
    expect(() => decodePolyline('???~~~', 6)).not.toThrow();
  });

  it('decodes precision-6 polyline correctly into [lng, lat] pairs', () => {
    // Helper to encode delta
    function encodeNumber(num: number): string {
      let sgn_num = num < 0 ? ~(num << 1) : num << 1;
      let encodeString = '';
      while (sgn_num >= 0x20) {
        encodeString += String.fromCharCode((0x20 | (sgn_num & 0x1f)) + 63);
        sgn_num >>= 5;
      }
      encodeString += String.fromCharCode(sgn_num + 63);
      return encodeString;
    }

    function encodePoints(pts: [number, number][], precision: number = 6): string {
      const factor = Math.pow(10, precision);
      let output = '';
      let lastLat = 0;
      let lastLng = 0;

      for (const [lat, lng] of pts) {
        const roundLat = Math.round(lat * factor);
        const roundLng = Math.round(lng * factor);
        output += encodeNumber(roundLat - lastLat);
        output += encodeNumber(roundLng - lastLng);
        lastLat = roundLat;
        lastLng = roundLng;
      }
      return output;
    }

    const testCoords: [number, number][] = [
      [13.0827, 80.2707],
      [13.0850, 80.2750],
      [13.0900, 80.2800],
    ];

    const encoded = encodePoints(testCoords, 6);
    const decoded = decodePolyline(encoded, 6);

    expect(decoded.length).toBe(3);
    // Note: decodePolyline returns [longitude, latitude] GeoJSON format
    expect(decoded[0]![0]).toBeCloseTo(80.2707, 4);
    expect(decoded[0]![1]).toBeCloseTo(13.0827, 4);
    expect(decoded[1]![0]).toBeCloseTo(80.2750, 4);
    expect(decoded[1]![1]).toBeCloseTo(13.0850, 4);
    expect(decoded[2]![0]).toBeCloseTo(80.2800, 4);
    expect(decoded[2]![1]).toBeCloseTo(13.0900, 4);
  });

  it('supports precision 5 encoding when requested', () => {
    // Precision 5 test point: (38.5, -120.2)
    // Standard polyline encoding for this point in precision 5 is "_p~iF~ps|U"
    const decoded = decodePolyline('_p~iF~ps|U', 5);
    expect(decoded.length).toBe(1);
    expect(decoded[0]![0]).toBeCloseTo(-120.2, 4); // lng
    expect(decoded[0]![1]).toBeCloseTo(38.5, 4);   // lat
  });
});
