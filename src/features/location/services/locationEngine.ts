import * as Location from 'expo-location';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import type {
  LocationTrackingState,
  MovementState,
  RawPositionFix,
} from '../types';
import { locationPermissionService } from './locationPermissionService';
import { locationSessionService } from './locationSessionService';
import { MovementEngine } from './movementEngine';
import { LocationTransmissionPolicy } from './locationTransmissionPolicy';

export class LocationEngine {
  private isActive = false;
  private activeSessionId: string | null = null;
  private activeGroupId: string | null = null;
  private activeUserId: string | null = null;

  private subscription: Location.LocationSubscription | null = null;
  private appStateSubscription: NativeEventSubscription | null = null;

  private movementEngine = new MovementEngine();
  private transmissionPolicy = new LocationTransmissionPolicy();

  private lastTransmittedFix: RawPositionFix | null = null;
  private lastTransmittedTimeMs: number | null = null;
  private currentFix: RawPositionFix | null = null;
  private transmissionCount = 0;
  private lastError: string | null = null;

  private latestUnsentFix: RawPositionFix | null = null;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private isTransmitting = false;

  private listeners = new Set<(state: LocationTrackingState) => void>();

  constructor() {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this),
    );
  }

  /**
   * Subscribes a listener to live tracking state updates.
   */
  subscribe(listener: (state: LocationTrackingState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Returns a snapshot of the current location tracking state.
   */
  getState(): LocationTrackingState {
    return {
      isTracking: this.isActive,
      movementState: this.movementEngine.getState(),
      currentFix: this.currentFix,
      lastTransmittedAt: this.lastTransmittedTimeMs
        ? new Date(this.lastTransmittedTimeMs).toISOString()
        : null,
      transmissionCount: this.transmissionCount,
      error: this.lastError,
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Suppress listener callback errors to guard the engine loop
      }
    }
  }

  /**
   * Starts tracking for an authorized session and user.
   * Guarantees a single active watcher (idempotent).
   */
  async startTracking(
    sessionId: string,
    groupId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!sessionId || !groupId || !userId) {
      return { success: false, error: 'Session ID, Group ID, and User ID are required.' };
    }

    // Idempotency: already tracking this exact session
    if (
      this.isActive &&
      this.activeSessionId === sessionId &&
      this.activeUserId === userId
    ) {
      return { success: true };
    }

    // If tracking a different session, stop previous watcher cleanly first
    if (this.isActive) {
      this.stopTracking();
    }

    // Permission Verification
    const permState = await locationPermissionService.checkForegroundPermission();
    if (permState !== 'GRANTED') {
      this.lastError = 'Location permission is not granted.';
      this.notifyListeners();
      return { success: false, error: this.lastError };
    }

    this.isActive = true;
    this.activeSessionId = sessionId;
    this.activeGroupId = groupId;
    this.activeUserId = userId;
    this.lastError = null;
    this.transmissionCount = 0;
    this.movementEngine.reset();
    this.lastTransmittedFix = null;
    this.lastTransmittedTimeMs = null;
    this.currentFix = null;
    this.latestUnsentFix = null;

    try {
      // Balanced accuracy provides high physical fidelity (15-25m) while drawing
      // significantly less power than continuous high-drain satellite locking.
      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 3000, // Sample GPS every ~3 seconds for movement evaluation
          distanceInterval: 5, // Trigger callback after ~5 meters displacement
        },
        (loc) => {
          this.processLocationObject(loc);
        },
      );

      this.notifyListeners();
      return { success: true };
    } catch (err: unknown) {
      this.stopTracking();
      const message = err instanceof Error ? err.message : 'Failed to start GPS watcher.';
      this.lastError = message;
      this.notifyListeners();
      return { success: false, error: message };
    }
  }

  /**
   * Ingests a raw Expo location object, classifies movement, and evaluates transmission policy.
   */
  private processLocationObject(location: Location.LocationObject): void {
    if (!this.isActive || !this.activeSessionId || !this.activeUserId) {
      return;
    }

    const rawFix: RawPositionFix = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 10,
      altitude: location.coords.altitude,
      heading: location.coords.heading,
      speed: location.coords.speed,
      timestamp: location.timestamp || Date.now(),
    };

    this.currentFix = rawFix;

    // 1. Movement classification
    const movementState: MovementState = this.movementEngine.processFix(rawFix);

    // 2. Adaptive transmission decision
    const decision = this.transmissionPolicy.shouldTransmit(
      rawFix,
      this.lastTransmittedFix,
      this.lastTransmittedTimeMs,
      movementState,
    );

    this.notifyListeners();

    // 3. Network transmission if authorized by policy
    if (decision.shouldTransmit) {
      this.transmitLocation(rawFix, this.activeSessionId, this.activeUserId);
    }
  }

  /**
   * Securely upserts coordinates to Supabase current_locations.
   */
  private async transmitLocation(
    fix: RawPositionFix,
    sessionId: string,
    userId: string,
  ): Promise<void> {
    if (!this.isActive || this.activeSessionId !== sessionId || this.activeUserId !== userId) {
      return;
    }

    if (this.isTransmitting) {
      this.latestUnsentFix = fix;
      return;
    }

    this.isTransmitting = true;

    try {
      const res = await locationSessionService.upsertCurrentLocation(sessionId, userId, {
        latitude: fix.latitude,
        longitude: fix.longitude,
        accuracy: fix.accuracy,
        speed: fix.speed ?? null,
        heading: fix.heading ?? null,
        recordedAt: new Date(fix.timestamp).toISOString(),
      });

      if (!this.isActive || this.activeSessionId !== sessionId) {
        return;
      }

      if (res.success) {
        this.lastTransmittedFix = fix;
        this.lastTransmittedTimeMs = fix.timestamp;
        this.transmissionCount += 1;
        this.lastError = null;
        this.latestUnsentFix = null;
        this.clearRetryTimeout();
      } else {
        this.lastError = res.error || 'Failed to transmit coordinates.';
        this.latestUnsentFix = fix;
        this.scheduleBoundedRetry(sessionId, userId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Network error during coordinate write.';
      this.lastError = message;
      this.latestUnsentFix = fix;
      this.scheduleBoundedRetry(sessionId, userId);
    } finally {
      this.isTransmitting = false;
      this.notifyListeners();
    }
  }

  /**
   * Bounded retry: attempts single transmission of latestUnsentFix after 10s backoff.
   */
  private scheduleBoundedRetry(sessionId: string, userId: string): void {
    if (this.retryTimeoutId || !this.isActive) return;

    this.retryTimeoutId = setTimeout(() => {
      this.retryTimeoutId = null;
      if (this.isActive && this.latestUnsentFix && this.activeSessionId === sessionId) {
        this.transmitLocation(this.latestUnsentFix, sessionId, userId);
      }
    }, 10000);
  }

  private clearRetryTimeout(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  /**
   * Completely tears down the active location watcher and all timers.
   */
  stopTracking(): void {
    if (this.subscription) {
      try {
        this.subscription.remove();
      } catch {
        // Gracefully ignore subscription removal issues
      }
      this.subscription = null;
    }

    this.clearRetryTimeout();
    this.movementEngine.reset();

    this.isActive = false;
    this.activeSessionId = null;
    this.activeGroupId = null;
    this.activeUserId = null;
    this.latestUnsentFix = null;
    this.isTransmitting = false;

    this.notifyListeners();
  }

  /**
   * Lifecycle handler: validates permissions and session state on app resume.
   */
  private async handleAppStateChange(nextAppState: AppStateStatus): Promise<void> {
    if (nextAppState === 'active' && this.isActive && this.activeSessionId && this.activeUserId) {
      const permState = await locationPermissionService.checkForegroundPermission();
      if (permState !== 'GRANTED') {
        this.stopTracking();
        this.lastError = 'Location permission revoked while in background.';
        this.notifyListeners();
      }
    }
  }

  /**
   * External hook: immediately aborts tracking if authentication or space expires.
   */
  onGroupExpired(groupId: string): void {
    if (this.activeGroupId === groupId) {
      this.stopTracking();
    }
  }

  onAuthSignedOut(): void {
    this.stopTracking();
  }

  destroy(): void {
    this.stopTracking();
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.listeners.clear();
  }
}

export const locationEngine = new LocationEngine();
