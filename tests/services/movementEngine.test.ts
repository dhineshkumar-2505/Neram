import { MovementEngine } from '../../src/features/location/services/movementEngine';
import type { RawPositionFix } from '../../src/features/location/types';

describe('MovementEngine', () => {
  let engine: MovementEngine;

  beforeEach(() => {
    engine = new MovementEngine();
  });

  const createFix = (
    lat: number,
    lon: number,
    speed: number | null,
    timestamp: number,
    accuracy = 10,
  ): RawPositionFix => ({
    latitude: lat,
    longitude: lon,
    accuracy,
    speed,
    timestamp,
  });

  it('initializes in UNKNOWN state and transitions to STATIONARY on zero speed initial fix', () => {
    expect(engine.getState()).toBe('UNKNOWN');

    const now = Date.now();
    const fix1 = createFix(40.7128, -74.006, 0.1, now);
    const state = engine.processFix(fix1);

    expect(state).toBe('STATIONARY');
    expect(engine.getState()).toBe('STATIONARY');
  });

  it('classifies consecutive zero or low displacement fixes as STATIONARY', () => {
    const baseTime = Date.now();
    const fix1 = createFix(40.7128, -74.006, 0.2, baseTime);
    const fix2 = createFix(40.7128001, -74.0060001, 0.1, baseTime + 3000);
    const fix3 = createFix(40.7128, -74.006, 0.0, baseTime + 6000);

    engine.processFix(fix1);
    engine.processFix(fix2);
    const finalState = engine.processFix(fix3);

    expect(finalState).toBe('STATIONARY');
  });

  it('classifies pedestrian movement (speed between 0.8 and 5.5 m/s) as WALKING', () => {
    const baseTime = Date.now();
    const fix1 = createFix(40.7128, -74.006, 1.4, baseTime);
    // Move ~4.5m in 3 seconds (1.5 m/s)
    const fix2 = createFix(40.71284, -74.006, 1.5, baseTime + 3000);

    engine.processFix(fix1);
    const state = engine.processFix(fix2);

    expect(state).toBe('WALKING');
  });

  it('requires consecutive driving observations before stabilizing in DRIVING state (hysteresis)', () => {
    const baseTime = Date.now();
    // Start walking
    const fix1 = createFix(40.7128, -74.006, 1.5, baseTime);
    const fix2 = createFix(40.71284, -74.006, 1.5, baseTime + 3000);
    engine.processFix(fix1);
    expect(engine.processFix(fix2)).toBe('WALKING');

    // First spike reading at 8.0 m/s with small displacement (noise)
    const spikeFix = createFix(40.71286, -74.006, 8.0, baseTime + 6000);
    const stateAfterSpike = engine.processFix(spikeFix);
    // Should NOT jump to DRIVING on single spike with small displacement
    expect(stateAfterSpike).toBe('WALKING');

    // Second consistent driving observation with high speed and displacement (~30m in 3s)
    const drivingFix = createFix(40.7131, -74.006, 10.0, baseTime + 9000);
    const stateAfterSecond = engine.processFix(drivingFix);
    expect(stateAfterSecond).toBe('DRIVING');
  });

  it('transitions from DRIVING to STATIONARY only after multiple consecutive stationary fixes', () => {
    const baseTime = Date.now();
    // Drive
    engine.processFix(createFix(40.7128, -74.006, 12.0, baseTime));
    engine.processFix(createFix(40.7132, -74.006, 12.0, baseTime + 3000));
    expect(engine.getState()).toBe('DRIVING');

    // First stop (e.g. red light): 1 fix with 0 speed
    engine.processFix(createFix(40.7132, -74.006, 0.0, baseTime + 6000));
    expect(engine.getState()).toBe('DRIVING'); // Hysteresis holds driving at brief pause

    // Second stop fix
    engine.processFix(createFix(40.7132, -74.006, 0.0, baseTime + 9000));
    expect(engine.getState()).toBe('DRIVING');

    // Third stop fix confirms stationary
    const finalState = engine.processFix(createFix(40.7132, -74.006, 0.0, baseTime + 12000));
    expect(finalState).toBe('STATIONARY');
  });

  it('resets internal state when reset() is called', () => {
    engine.processFix(createFix(40.7128, -74.006, 1.4, Date.now()));
    expect(engine.getState()).toBe('WALKING');

    engine.reset();
    expect(engine.getState()).toBe('UNKNOWN');
  });
});
