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

  return {
    Map,
    Camera,
    Marker,
    Callout,
    ViewAnnotation,
    UserLocation: () => null,
  };
});
