import {
  SchedulingAlgorithm,
  InteractionStyle,
  isFixedAlgorithm,
  isSpacedAlgorithm,
  isLBLReviewMode,
  ALGORITHM_META,
  INTERACTION_META,
} from '~/models/session';

describe('mode classification functions', () => {
  it('isFixedAlgorithm returns true for Fixed algorithms', () => {
    expect(isFixedAlgorithm(SchedulingAlgorithm.PROGRESSIVE)).toBe(true);
    expect(isFixedAlgorithm(SchedulingAlgorithm.FIXED_DAYS)).toBe(true);
    expect(isFixedAlgorithm(SchedulingAlgorithm.FIXED_WEEKS)).toBe(true);
    expect(isFixedAlgorithm(SchedulingAlgorithm.FIXED_MONTHS)).toBe(true);
    expect(isFixedAlgorithm(SchedulingAlgorithm.FIXED_YEARS)).toBe(true);
    expect(isFixedAlgorithm(SchedulingAlgorithm.SM2)).toBe(false);
  });

  it('isSpacedAlgorithm returns true for Spaced algorithms', () => {
    expect(isSpacedAlgorithm(SchedulingAlgorithm.SM2)).toBe(true);
    expect(isSpacedAlgorithm(SchedulingAlgorithm.PROGRESSIVE)).toBe(false);
    expect(isSpacedAlgorithm(SchedulingAlgorithm.FIXED_DAYS)).toBe(false);
    expect(isSpacedAlgorithm(SchedulingAlgorithm.FIXED_WEEKS)).toBe(false);
    expect(isSpacedAlgorithm(SchedulingAlgorithm.FIXED_MONTHS)).toBe(false);
    expect(isSpacedAlgorithm(SchedulingAlgorithm.FIXED_YEARS)).toBe(false);
  });

  it('isLBLReviewMode returns true only for LBL interaction', () => {
    expect(isLBLReviewMode(InteractionStyle.LBL)).toBe(true);
    expect(isLBLReviewMode(InteractionStyle.NORMAL)).toBe(false);
  });

  it('all classification functions return false for undefined', () => {
    expect(isFixedAlgorithm(undefined)).toBe(false);
    expect(isSpacedAlgorithm(undefined)).toBe(false);
    expect(isLBLReviewMode(undefined)).toBe(false);
  });
});

describe('ALGORITHM_META', () => {
  it('has an entry for every SchedulingAlgorithm enum value', () => {
    const allAlgorithms = Object.values(SchedulingAlgorithm);
    for (const algo of allAlgorithms) {
      expect(algo in ALGORITHM_META).toBe(true);
    }
  });

  it('every entry has a valid group', () => {
    const validGroups: string[] = ['Spaced', 'Fixed'];
    const entries = Object.values(ALGORITHM_META);
    for (const entry of entries) {
      expect(validGroups).toContain(entry.group);
    }
  });

  it('every entry has a non-empty label', () => {
    const entries = Object.values(ALGORITHM_META);
    for (const entry of entries) {
      expect(entry.label).toBeTruthy();
      expect(typeof entry.label).toBe('string');
    }
  });
});

describe('INTERACTION_META', () => {
  it('has an entry for every InteractionStyle enum value', () => {
    const allInteractions = Object.values(InteractionStyle);
    for (const inter of allInteractions) {
      expect(inter in INTERACTION_META).toBe(true);
    }
  });

  it('every entry has a non-empty label', () => {
    const entries = Object.values(INTERACTION_META);
    for (const entry of entries) {
      expect(entry.label).toBeTruthy();
      expect(typeof entry.label).toBe('string');
    }
  });
});
