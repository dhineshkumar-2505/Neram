import * as Haptics from 'expo-haptics';
import { haptics, setHapticsReducedMotion, resetHapticsThrottle } from '../../src/utils/haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

describe('haptics utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHapticsReducedMotion(false);
    resetHapticsThrottle();
  });

  it('triggers selection feedback', async () => {
    await haptics.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('triggers tick feedback with light impact', async () => {
    await haptics.tick();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  it('rate-limits high frequency tick calls within 40ms window', async () => {
    // First call succeeds
    await haptics.tick();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    // Immediate second call should be suppressed
    await haptics.tick();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  });

  it('triggers boundary feedback with medium impact', async () => {
    await haptics.boundary();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('triggers confirm feedback with medium impact', async () => {
    await haptics.confirm();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('triggers success notification', async () => {
    await haptics.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('triggers warning notification', async () => {
    await haptics.warning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('warning');
  });

  it('triggers error notification', async () => {
    await haptics.error();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('error');
  });

  it('suppresses all haptics when reduced motion is active', async () => {
    setHapticsReducedMotion(true);

    await haptics.selection();
    await haptics.tick();
    await haptics.boundary();
    await haptics.confirm();
    await haptics.success();
    await haptics.warning();
    await haptics.error();

    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});
