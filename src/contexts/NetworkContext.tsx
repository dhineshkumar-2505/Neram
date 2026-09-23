import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import {
  networkStatusService,
  NetworkStatus,
} from '../services/networkStatus';

export interface NetworkContextValue extends NetworkStatus {
  isRestored: boolean;
}

const defaultStatus: NetworkContextValue = {
  isConnected: true,
  isInternetReachable: true,
  isRealtimeConnected: true,
  isOffline: false,
  isRestored: false,
};

export const NetworkContext = createContext<NetworkContextValue>(defaultStatus);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<NetworkStatus>(() => networkStatusService.getStatus());
  const [isRestored, setIsRestored] = useState<boolean>(false);
  const wasOfflineRef = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = networkStatusService.subscribe((newStatus) => {
      setStatus(newStatus);

      if (newStatus.isOffline) {
        wasOfflineRef.current = true;
        setIsRestored(false);
      } else if (wasOfflineRef.current && !newStatus.isOffline) {
        wasOfflineRef.current = false;
        setIsRestored(true);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <NetworkContext.Provider value={{ ...status, isRestored }}>
      {children}
    </NetworkContext.Provider>
  );
};

export function useNetworkStatus(): NetworkContextValue {
  return useContext(NetworkContext);
}

export default NetworkContext;
