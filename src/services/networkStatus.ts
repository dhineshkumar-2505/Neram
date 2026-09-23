import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isRealtimeConnected: boolean;
  isOffline: boolean;
}

export type NetworkListener = (status: NetworkStatus) => void;

class NetworkStatusService {
  private listeners: Set<NetworkListener> = new Set();
  private currentStatus: NetworkStatus = {
    isConnected: true,
    isInternetReachable: true,
    isRealtimeConnected: true,
    isOffline: false,
  };
  private isInitialized = false;
  private unsubscribeNetInfo: (() => void) | null = null;

  public getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  public initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen to device network state
    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetInfoChange(state);
    });

    // Check initial NetInfo state
    NetInfo.fetch()
      .then((state) => {
        this.handleNetInfoChange(state);
      })
      .catch(() => {
        // Fallback for mock environments
      });

    // Monitor Supabase Realtime channel status
    try {
      const channel = supabase.channel('neram_network_heartbeat');
      channel.subscribe((status) => {
        const isRealtimeUp = status === 'SUBSCRIBED';
        this.updateStatus({
          isRealtimeConnected: isRealtimeUp,
        });
      });
    } catch {
      // Fallback for mock environments
    }
  }

  private handleNetInfoChange(state: NetInfoState): void {
    const isConn = Boolean(state.isConnected);
    const isReachable = state.isInternetReachable ?? isConn;
    const isOffline = !isConn || !isReachable;

    this.updateStatus({
      isConnected: isConn,
      isInternetReachable: state.isInternetReachable,
      isOffline,
    });
  }

  private updateStatus(partial: Partial<NetworkStatus>): void {
    const prev = this.currentStatus;
    const updated: NetworkStatus = {
      ...prev,
      ...partial,
    };
    updated.isOffline = !updated.isConnected || updated.isInternetReachable === false;

    if (
      prev.isConnected !== updated.isConnected ||
      prev.isInternetReachable !== updated.isInternetReachable ||
      prev.isRealtimeConnected !== updated.isRealtimeConnected ||
      prev.isOffline !== updated.isOffline
    ) {
      this.currentStatus = updated;
      this.notifyListeners();
    }
  }

  public subscribe(listener: NetworkListener): () => void {
    this.initialize();
    this.listeners.add(listener);
    listener(this.getStatus());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch {
        // Prevent subscriber crash
      }
    });
  }

  public resetForTesting(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.listeners.clear();
    this.isInitialized = false;
    this.currentStatus = {
      isConnected: true,
      isInternetReachable: true,
      isRealtimeConnected: true,
      isOffline: false,
    };
  }

  public simulateStatus(partial: Partial<NetworkStatus>): void {
    this.updateStatus(partial);
  }
}

export const networkStatusService = new NetworkStatusService();
export default networkStatusService;
