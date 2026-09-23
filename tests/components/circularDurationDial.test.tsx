import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import {
  CircularDurationDial,
  clampDurationUnit,
  calculateExpiryDate,
  formatDurationHuman,
  formatDurationBadge,
  durationToTotalHours,
  DURATION_LIMITS,
  DURATION_PRESETS,
} from '../../src/features/groups';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

describe('Duration Pure Calculations & Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('durationToTotalHours', () => {
    it('calculates total hours across months, days, and hours', () => {
      expect(durationToTotalHours({ months: 0, days: 0, hours: 4 })).toBe(4);
      expect(durationToTotalHours({ months: 0, days: 1, hours: 0 })).toBe(24);
      expect(durationToTotalHours({ months: 0, days: 3, hours: 12 })).toBe(84);
      expect(durationToTotalHours({ months: 1, days: 0, hours: 0 })).toBe(720);
    });
  });

  describe('clampDurationUnit', () => {
    it('clamps hours within 0 and 24', () => {
      expect(clampDurationUnit('hours', -5)).toBe(0);
      expect(clampDurationUnit('hours', 12)).toBe(12);
      expect(clampDurationUnit('hours', 30)).toBe(24);
      expect(clampDurationUnit('hours', 14.6)).toBe(15);
    });

    it('clamps days within 0 and 31', () => {
      expect(clampDurationUnit('days', -1)).toBe(0);
      expect(clampDurationUnit('days', 15)).toBe(15);
      expect(clampDurationUnit('days', 35)).toBe(31);
    });

    it('clamps months within 0 and 12', () => {
      expect(clampDurationUnit('months', -2)).toBe(0);
      expect(clampDurationUnit('months', 6)).toBe(6);
      expect(clampDurationUnit('months', 15)).toBe(12);
    });
  });

  describe('calculateExpiryDate', () => {
    const fixedNow = new Date('2026-09-23T12:00:00.000Z');

    it('adds hours correctly to baseline date', () => {
      const expiry = calculateExpiryDate(fixedNow, { months: 0, days: 0, hours: 6 });
      expect(expiry.getTime()).toBe(fixedNow.getTime() + 6 * 3600 * 1000);
    });

    it('adds days correctly to baseline date', () => {
      const expiry = calculateExpiryDate(fixedNow, { months: 0, days: 2, hours: 0 });
      expect(expiry.getTime()).toBe(fixedNow.getTime() + 2 * 24 * 3600 * 1000);
    });

    it('enforces minimum 1 hour forward progress when all units are zero (PostgreSQL constraint)', () => {
      const expiry = calculateExpiryDate(fixedNow, { months: 0, days: 0, hours: 0 });
      expect(expiry.getTime()).toBeGreaterThan(fixedNow.getTime());
      expect(expiry.getTime() - fixedNow.getTime()).toBe(3600 * 1000);
    });
  });

  describe('formatDurationHuman & formatDurationBadge', () => {
    it('formats human strings for single and compound durations', () => {
      expect(formatDurationHuman({ months: 0, days: 0, hours: 4 })).toBe('4 Hours');
      expect(formatDurationHuman({ months: 0, days: 1, hours: 0 })).toBe('1 Day');
      expect(formatDurationHuman({ months: 1, days: 2, hours: 3 })).toBe('1 Month 2 Days 3 Hours');
      expect(formatDurationHuman({ months: 0, days: 0, hours: 0 })).toBe('1 Hour (Minimum)');
    });

    it('formats short badge strings', () => {
      expect(formatDurationBadge({ months: 0, days: 0, hours: 4 })).toBe('4h');
      expect(formatDurationBadge({ months: 0, days: 3, hours: 0 })).toBe('3d');
      expect(formatDurationBadge({ months: 1, days: 0, hours: 0 })).toBe('1m');
      expect(formatDurationBadge({ months: 1, days: 2, hours: 5 })).toBe('1m 2d 5h');
      expect(formatDurationBadge({ months: 0, days: 0, hours: 0 })).toBe('1h');
    });
  });

  describe('DURATION_PRESETS', () => {
    it('defines valid archetypes with matching durations', () => {
      expect(DURATION_PRESETS.length).toBe(5);
      const fourHour = DURATION_PRESETS.find((p) => p.id === '4h');
      expect(fourHour?.archetype).toBe('Outing');
      expect(fourHour?.duration.hours).toBe(4);

      const oneWeek = DURATION_PRESETS.find((p) => p.id === '1w');
      expect(oneWeek?.archetype).toBe('Sprint');
      expect(oneWeek?.duration.days).toBe(7);
    });
  });
});

describe('CircularDurationDial Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders default 4 hours configuration and expiration card', () => {
    const { getByText, getAllByText, getByRole, getByLabelText } = render(<CircularDurationDial />);

    expect(getByRole('tab', { name: /Configure hours/i })).toBeTruthy();
    expect(getByRole('tab', { name: /Configure days/i })).toBeTruthy();
    expect(getByRole('tab', { name: /Configure months/i })).toBeTruthy();
    expect(getAllByText('HOURS').length).toBeGreaterThanOrEqual(1);
    expect(getByText('ADJUSTING')).toBeTruthy();
    expect(getByLabelText('Duration Dial: 4 hours')).toBeTruthy();
    expect(getByText('TOTAL LIFESPAN: 4 HOURS')).toBeTruthy();
  });

  it('renders custom initial values and startsAt baseline', () => {
    const baseline = new Date('2026-10-01T10:00:00.000Z');
    const { getByLabelText, getByText } = render(
      <CircularDurationDial
        value={{ months: 1, days: 5, hours: 12 }}
        startsAt={baseline}
      />,
    );

    // Initial unit tab is hours
    expect(getByLabelText('Duration Dial: 12 hours')).toBeTruthy();
    expect(getByText('TOTAL LIFESPAN: 1 MONTH 5 DAYS 12 HOURS')).toBeTruthy();
  });

  it('switches between unit tabs (HOURS, DAYS, MONTHS)', () => {
    const { getByRole, getByLabelText } = render(
      <CircularDurationDial value={{ months: 2, days: 6, hours: 8 }} />,
    );

    // Switch to DAYS
    const daysTab = getByRole('tab', { name: /Configure days/i });
    fireEvent.press(daysTab);
    expect(getByLabelText('Duration Dial: 6 days')).toBeTruthy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');

    // Switch to MONTHS
    const monthsTab = getByRole('tab', { name: /Configure months/i });
    fireEvent.press(monthsTab);
    expect(getByLabelText('Duration Dial: 2 months')).toBeTruthy();
  });

  it('increments and decrements unit value via micro-steppers', () => {
    const handleChange = jest.fn();
    const { getByRole } = render(
      <CircularDurationDial
        value={{ months: 0, days: 0, hours: 4 }}
        onChange={handleChange}
      />,
    );

    const increaseBtn = getByRole('button', { name: /Increase hours/i });
    const decreaseBtn = getByRole('button', { name: /Decrease hours/i });

    // Increment 4 -> 5
    fireEvent.press(increaseBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        months: 0,
        days: 0,
        hours: 5,
        totalHours: 5,
      }),
    );
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');

    // Decrement 5 -> 4
    fireEvent.press(decreaseBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        months: 0,
        days: 0,
        hours: 4,
        totalHours: 4,
      }),
    );
  });

  it('enforces minimum 1 hour if all values are decremented to zero', () => {
    const handleChange = jest.fn();
    const { getByRole } = render(
      <CircularDurationDial
        value={{ months: 0, days: 0, hours: 1 }}
        onChange={handleChange}
      />,
    );

    const decreaseBtn = getByRole('button', { name: /Decrease hours/i });
    fireEvent.press(decreaseBtn);

    // emitChange intercepts all-zero condition and sets effective hours to 1
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        months: 0,
        days: 0,
        hours: 1,
        totalHours: 1,
      }),
    );
  });

  it('respects upper bounds for units', () => {
    const handleChange = jest.fn();
    const { getByRole } = render(
      <CircularDurationDial
        value={{ months: 0, days: 0, hours: DURATION_LIMITS.hours.max }}
        onChange={handleChange}
      />,
    );

    const increaseBtn = getByRole('button', { name: /Increase hours/i });
    fireEvent.press(increaseBtn);

    // Does not fire change when already at max
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('selects quick archetype presets', () => {
    const handleChange = jest.fn();
    const { getByRole } = render(
      <CircularDurationDial onChange={handleChange} />,
    );

    const weekendChip = getByRole('button', { name: /Set duration to 3 Days for Weekend/i });
    fireEvent.press(weekendChip);

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        months: 0,
        days: 3,
        hours: 0,
        totalHours: 72,
      }),
    );
    expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');
  });

  it('ignores touches and buttons when disabled', () => {
    const handleChange = jest.fn();
    const { getByRole } = render(
      <CircularDurationDial
        value={{ months: 0, days: 0, hours: 4 }}
        onChange={handleChange}
        disabled={true}
      />,
    );

    const increaseBtn = getByRole('button', { name: /Increase hours/i });
    fireEvent.press(increaseBtn);
    expect(handleChange).not.toHaveBeenCalled();

    const outingChip = getByRole('button', { name: /Set duration to 24 Hours for Hackathon/i });
    fireEvent.press(outingChip);
    expect(handleChange).not.toHaveBeenCalled();
  });
});
