process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-placeholder';

// Mock @maplibre/maplibre-react-native for Jest tests
jest.mock('@maplibre/maplibre-react-native', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Map = ({ children, testID, ...props }: any) => {
    return React.createElement(View, { testID: testID || 'maplibre-map-view', ...props }, children);
  };

  const Camera = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      flyTo: jest.fn(),
      easeTo: jest.fn(),
      jumpTo: jest.fn(),
      fitBounds: jest.fn(),
      zoomTo: jest.fn(),
    }));
    return React.createElement(View, { testID: 'maplibre-camera', ...props });
  });
  Camera.displayName = 'Camera';

  const Marker = ({ children, testID, id, lngLat, ...props }: any) => {
    return React.createElement(
      View,
      { testID: testID || `maplibre-marker-${id || 'unknown'}`, 'data-lng-lat': lngLat, ...props },
      children
    );
  };

  const Callout = ({ children, ...props }: any) => {
    return React.createElement(View, { testID: 'maplibre-callout', ...props }, children);
  };

  const ViewAnnotation = ({ children, ...props }: any) => {
    return React.createElement(View, { testID: 'maplibre-view-annotation', ...props }, children);
  };

  const GeoJSONSource = ({ children, testID, ...props }: any) => {
    return React.createElement(View, { testID: testID || 'maplibre-geojson-source', ...props }, children);
  };

  const Layer = ({ testID, id, ...props }: any) => {
    return React.createElement(View, { testID: testID || `maplibre-layer-${id || 'line'}`, ...props });
  };

  return {
    Map,
    Camera,
    Marker,
    Callout,
    ViewAnnotation,
    GeoJSONSource,
    Layer,
    UserLocation: () => null,
  };
});

// Mock expo-av for Jest tests
jest.mock('expo-av', () => {
  const mockRecording = {
    prepareToRecordAsync: jest.fn().mockResolvedValue({}),
    startAsync: jest.fn().mockResolvedValue({}),
    stopAndUnloadAsync: jest.fn().mockResolvedValue({}),
    getURI: jest.fn().mockReturnValue('file:///mock/recording.m4a'),
    setOnRecordingStatusUpdate: jest.fn(),
  };

  const mockSound = {
    playAsync: jest.fn().mockResolvedValue({}),
    pauseAsync: jest.fn().mockResolvedValue({}),
    stopAsync: jest.fn().mockResolvedValue({}),
    unloadAsync: jest.fn().mockResolvedValue({}),
    setPositionAsync: jest.fn().mockResolvedValue({}),
    getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: false }),
  };

  return {
    Audio: {
      requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
      setAudioModeAsync: jest.fn().mockResolvedValue({}),
      Recording: jest.fn().mockImplementation(() => mockRecording),
      Sound: {
        createAsync: jest.fn().mockResolvedValue({ sound: mockSound }),
      },
      RecordingOptionsPresets: {
        HIGH_QUALITY: {},
      },
    },
  };
});

// Mock expo-camera for Jest tests
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    CameraView: ({ children, ...props }: any) =>
      React.createElement(View, { testID: 'camera-view', ...props }, children),
    useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
  };
});

// Mock expo-crypto for Jest tests
jest.mock('expo-crypto', () => {
  const crypto = require('crypto');
  return {
    CryptoDigestAlgorithm: {
      SHA256: 'SHA-256',
    },
    digestStringAsync: jest.fn(async (_algo: string, str: string) => {
      return crypto.createHash('sha256').update(str).digest('hex');
    }),
    getRandomBytesAsync: jest.fn(async (byteCount: number) => {
      return crypto.randomBytes(byteCount);
    }),
  };
});

// Mock expo-file-system & expo-file-system/legacy for Jest tests
const mockFileSystem = {
  cacheDirectory: 'file:///mock/cache/',
  documentDirectory: 'file:///mock/documents/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1048576 }),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
};
jest.mock('expo-file-system', () => mockFileSystem);
jest.mock('expo-file-system/legacy', () => mockFileSystem);
