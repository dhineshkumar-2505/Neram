import { RoutingService } from '../../src/features/location/services/routingService';

describe('RoutingService', () => {
  let service: RoutingService;
  const mockBaseUrl = 'https://valhalla.example.com/route';

  beforeEach(() => {
    service = new RoutingService(mockBaseUrl);
    jest.clearAllMocks();
  });

  it('rejects invalid origin coordinates without calling fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await service.calculateRoute({
      origin: { latitude: 999, longitude: 80.0 }, // Invalid lat
      destination: { latitude: 13.0827, longitude: 80.2707 },
    });

    expect(result.route).toBeNull();
    expect(result.error).toContain('Invalid route origin');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid destination coordinates without calling fetch', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const result = await service.calculateRoute({
      origin: { latitude: 13.0827, longitude: 80.2707 },
      destination: { latitude: 13.0827, longitude: 999 }, // Invalid lng
    });

    expect(result.route).toBeNull();
    expect(result.error).toContain('Invalid route destination');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('constructs correct payload and parses valid Valhalla response', async () => {
    const fakeShape = '_p~iF~ps|U'; // standard valid mock polyline
    const mockResponse = {
      trip: {
        status: 0,
        summary: {
          length: 4.5, // 4.5 km -> 4500 m
          time: 540,   // 9 minutes
        },
        legs: [
          {
            shape: fakeShape,
            summary: { length: 4.5, time: 540 },
          },
        ],
      },
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const result = await service.calculateRoute({
      origin: { latitude: 13.0827, longitude: 80.2707 },
      destination: { latitude: 13.0850, longitude: 80.2750 },
      profile: 'auto',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0];
    expect(calledUrl).toBe(mockBaseUrl);
    expect(calledInit?.method).toBe('POST');

    const parsedBody = JSON.parse(calledInit?.body as string);
    expect(parsedBody.costing).toBe('auto');
    expect(parsedBody.locations).toEqual([
      { lat: 13.0827, lon: 80.2707 },
      { lat: 13.0850, lon: 80.2750 },
    ]);

    expect(result.error).toBeUndefined();
    expect(result.route).not.toBeNull();
    expect(result.route?.distanceMeters).toBe(4500);
    expect(result.route?.durationSeconds).toBe(540);
    expect(result.route?.profile).toBe('auto');
    expect(result.route?.coordinates.length).toBeGreaterThan(0);
  });

  it('supports pedestrian costing profile', async () => {
    const mockResponse = {
      trip: {
        summary: { length: 1.2, time: 900 },
        legs: [{ shape: '_p~iF~ps|U' }],
      },
    };

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    } as Response);

    const result = await service.calculateRoute({
      origin: { latitude: 13.0827, longitude: 80.2707 },
      destination: { latitude: 13.0850, longitude: 80.2750 },
      profile: 'pedestrian',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, calledInit] = fetchSpy.mock.calls[0];
    const parsedBody = JSON.parse(calledInit?.body as string);
    expect(parsedBody.costing).toBe('pedestrian');
    expect(result.route?.profile).toBe('pedestrian');
  });

  it('handles Valhalla API error response gracefully', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        error: 'No suitable edges near location',
        error_code: 171,
      }),
    } as Response);

    const result = await service.calculateRoute({
      origin: { latitude: 13.0827, longitude: 80.2707 },
      destination: { latitude: 13.0850, longitude: 80.2750 },
    });

    expect(result.route).toBeNull();
    expect(result.error).toContain('No suitable edges');
  });

  it('handles external cancellation signal without throwing', async () => {
    const abortCtrl = new AbortController();
    abortCtrl.abort();

    const result = await service.calculateRoute({
      origin: { latitude: 13.0827, longitude: 80.2707 },
      destination: { latitude: 13.0850, longitude: 80.2750 },
      signal: abortCtrl.signal,
    });

    expect(result.route).toBeNull();
    expect(result.error).toContain('cancelled');
  });
});
