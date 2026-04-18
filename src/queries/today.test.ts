import { getDueCardUids } from './today';
import { CompleteRecords, SchedulingAlgorithm, InteractionStyle, Session } from '~/models/session';

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  algorithm: SchedulingAlgorithm.SM2,
  interaction: InteractionStyle.NORMAL,
  repetitions: 0,
  interval: 0,
  eFactor: 2.5,
  ...overrides,
});

const makeCardData = (overrides: Partial<Session> = {}): Session[] => [makeSession(overrides)];

describe('getDueCardUids', () => {
  it('returns empty array when no session data', () => {
    const result = getDueCardUids({}, false);
    expect(result).toEqual([]);
  });

  it('returns only cards with nextDueDate in the past', () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 86400000);
    const futureDate = new Date(now.getTime() + 86400000);

    const sessionData: CompleteRecords = {
      card_past: makeCardData({ nextDueDate: pastDate }),
      card_future: makeCardData({ nextDueDate: futureDate }),
    };

    const result = getDueCardUids(sessionData, false);
    expect(result).toEqual(['card_past']);
  });

  it('returns all cards when cramming', () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 86400000 * 7);

    const sessionData: CompleteRecords = {
      card_a: makeCardData({ nextDueDate: futureDate }),
      card_b: makeCardData({ nextDueDate: futureDate }),
    };

    const result = getDueCardUids(sessionData, true);
    expect(result).toHaveLength(2);
  });

  describe('primary sort: nextDueDate (more overdue first)', () => {
    it('sorts more overdue cards before less overdue cards', () => {
      const now = new Date();
      const fiveDaysOverdue = new Date(now.getTime() - 86400000 * 5);
      const oneDayOverdue = new Date(now.getTime() - 86400000);
      const justDue = new Date(now.getTime() - 1000);

      const sessionData: CompleteRecords = {
        card_just_due: makeCardData({ nextDueDate: justDue }),
        card_five_overdue: makeCardData({ nextDueDate: fiveDaysOverdue }),
        card_one_overdue: makeCardData({ nextDueDate: oneDayOverdue }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result).toEqual([
        'card_five_overdue',
        'card_one_overdue',
        'card_just_due',
      ]);
    });

    it('treats earliest nextDueDate as most overdue', () => {
      const now = new Date();
      const tenDaysOverdue = new Date(now.getTime() - 86400000 * 10);
      const oneDayOverdue = new Date(now.getTime() - 86400000);

      const sessionData: CompleteRecords = {
        card_less_overdue: makeCardData({ nextDueDate: oneDayOverdue }),
        card_more_overdue: makeCardData({ nextDueDate: tenDaysOverdue }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result[0]).toBe('card_more_overdue');
    });
  });

  describe('secondary sort: eFactor (lower eFactor first when same due date)', () => {
    it('sorts lower eFactor before higher eFactor when due dates are equal', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 86400000);

      const sessionData: CompleteRecords = {
        card_easy: makeCardData({ nextDueDate: sameDate, eFactor: 2.8 }),
        card_hard: makeCardData({ nextDueDate: sameDate, eFactor: 1.3 }),
        card_medium: makeCardData({ nextDueDate: sameDate, eFactor: 2.0 }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result).toEqual(['card_hard', 'card_medium', 'card_easy']);
    });

    it('uses default eFactor 2.5 when eFactor is undefined', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 86400000);

      const sessionData: CompleteRecords = {
        card_no_efactor: makeCardData({ nextDueDate: sameDate, eFactor: undefined }),
        card_explicit_25: makeCardData({ nextDueDate: sameDate, eFactor: 2.5 }),
        card_low_efactor: makeCardData({ nextDueDate: sameDate, eFactor: 1.5 }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result[0]).toBe('card_low_efactor');
      expect(result[1]).toBe('card_no_efactor');
      expect(result[2]).toBe('card_explicit_25');
    });
  });

  describe('tertiary sort: repetitions (fewer repetitions first)', () => {
    it('sorts fewer repetitions before more repetitions when due dates and eFactor are equal', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 86400000);

      const sessionData: CompleteRecords = {
        card_mature: makeCardData({ nextDueDate: sameDate, eFactor: 2.5, repetitions: 10 }),
        card_new: makeCardData({ nextDueDate: sameDate, eFactor: 2.5, repetitions: 0 }),
        card_mid: makeCardData({ nextDueDate: sameDate, eFactor: 2.5, repetitions: 3 }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result).toEqual(['card_new', 'card_mid', 'card_mature']);
    });

    it('uses default repetitions 0 when undefined', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 86400000);

      const sessionData: CompleteRecords = {
        card_no_reps: makeCardData({ nextDueDate: sameDate, eFactor: 2.5, repetitions: undefined }),
        card_zero_reps: makeCardData({ nextDueDate: sameDate, eFactor: 2.5, repetitions: 0 }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result).toEqual(['card_no_reps', 'card_zero_reps']);
    });
  });

  describe('combined three-level sort', () => {
    it('sorts by due date first, then eFactor, then repetitions', () => {
      const now = new Date();
      const threeDaysOverdue = new Date(now.getTime() - 86400000 * 3);
      const oneDayOverdue = new Date(now.getTime() - 86400000);

      const sessionData: CompleteRecords = {
        card_a: makeCardData({ nextDueDate: threeDaysOverdue, eFactor: 2.8, repetitions: 10 }),
        card_b: makeCardData({ nextDueDate: oneDayOverdue, eFactor: 1.3, repetitions: 0 }),
        card_c: makeCardData({ nextDueDate: threeDaysOverdue, eFactor: 1.3, repetitions: 5 }),
        card_d: makeCardData({ nextDueDate: threeDaysOverdue, eFactor: 1.3, repetitions: 1 }),
        card_e: makeCardData({ nextDueDate: threeDaysOverdue, eFactor: 2.0, repetitions: 0 }),
      };

      const result = getDueCardUids(sessionData, false);

      expect(result).toEqual([
        'card_d',
        'card_c',
        'card_e',
        'card_a',
        'card_b',
      ]);
    });
  });
});
