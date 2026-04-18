import {
  SchedulingAlgorithm,
  InteractionStyle,
  isFixedMode,
  isSpacedMode,
  isLBLReviewMode,
  isLineByLineUI,
  ALGORITHM_META,
  INTERACTION_META,
} from '~/models/session';

describe('mode classification functions', () => {
  it('isFixedMode returns true for Fixed algorithms', () => {
    expect(isFixedMode(SchedulingAlgorithm.PROGRESSIVE)).toBe(true);
    expect(isFixedMode(SchedulingAlgorithm.FIXED_DAYS)).toBe(true);
    expect(isFixedMode(SchedulingAlgorithm.FIXED_WEEKS)).toBe(true);
    expect(isFixedMode(SchedulingAlgorithm.FIXED_MONTHS)).toBe(true);
    expect(isFixedMode(SchedulingAlgorithm.FIXED_YEARS)).toBe(true);
    expect(isFixedMode(SchedulingAlgorithm.SM2)).toBe(false);
  });

  it('isSpacedMode returns true for Spaced algorithms', () => {
    expect(isSpacedMode(SchedulingAlgorithm.SM2)).toBe(true);
    expect(isSpacedMode(SchedulingAlgorithm.PROGRESSIVE)).toBe(false);
    expect(isSpacedMode(SchedulingAlgorithm.FIXED_DAYS)).toBe(false);
    expect(isSpacedMode(SchedulingAlgorithm.FIXED_WEEKS)).toBe(false);
    expect(isSpacedMode(SchedulingAlgorithm.FIXED_MONTHS)).toBe(false);
    expect(isSpacedMode(SchedulingAlgorithm.FIXED_YEARS)).toBe(false);
  });

  it('isLBLReviewMode returns true only for LBL interaction', () => {
    expect(isLBLReviewMode(InteractionStyle.LBL)).toBe(true);
    expect(isLBLReviewMode(InteractionStyle.NORMAL)).toBe(false);
  });

  it('isLineByLineUI returns true only for LBL interaction', () => {
    expect(isLineByLineUI(InteractionStyle.LBL)).toBe(true);
    expect(isLineByLineUI(InteractionStyle.NORMAL)).toBe(false);
  });

  it('all classification functions return false for undefined', () => {
    expect(isFixedMode(undefined)).toBe(false);
    expect(isSpacedMode(undefined)).toBe(false);
    expect(isLBLReviewMode(undefined)).toBe(false);
    expect(isLineByLineUI(undefined)).toBe(false);
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
