import { getDueCardUids } from './today';
import { Records, SchedulingAlgorithm, InteractionStyle, Session } from '~/models/session';

const makeSession = (overrides: Partial<Session> = {}): Session => ({
  algorithm: SchedulingAlgorithm.SM2,
  interaction: InteractionStyle.NORMAL,
  sm2_repetitions: 0,
  sm2_interval: 0,
  sm2_eFactor: 2.5,
  ...overrides,
});

describe('getDueCardUids', () => {
  it('returns empty array when no session data', () => {
    const result = getDueCardUids({}, false);
    expect(result).toEqual([]);
  });

  it('returns only cards with nextDueDate in the past', () => {
    const now = new Date();
    const pastDate = new Date(now.getTime() - 86400000);
    const futureDate = new Date(now.getTime() + 86400000);

    const sessionData: Records = {
      card_past: makeSession({ nextDueDate: pastDate }),
      card_future: makeSession({ nextDueDate: futureDate }),
    };

    const result = getDueCardUids(sessionData, false);
    expect(result).toEqual(['card_past']);
  });

  it('returns all cards when cramming', () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 86400000 * 7);

    const sessionData: Records = {
      card_a: makeSession({ nextDueDate: futureDate }),
      card_b: makeSession({ nextDueDate: futureDate }),
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

      const sessionData: Records = {
        card_just_due: makeSession({ nextDueDate: justDue }),
        card_five_overdue: makeSession({ nextDueDate: fiveDaysOverdue }),
        card_one_overdue: makeSession({ nextDueDate: oneDayOverdue }),
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

      const sessionData: Records = {
        card_less_overdue: makeSession({ nextDueDate: oneDayOverdue }),
        card_more_overdue: makeSession({ nextDueDate: tenDaysOverdue }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result[0]).toBe('card_more_overdue');
    });
  });

  describe('secondary sort: eFactor (lower eFactor first when same due date)', () => {
    it('sorts lower eFactor before higher eFactor when due dates are equal', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 86400000);

      const sessionData: Records = {
        card_easy: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.8 }),
        card_hard: makeSession({ nextDueDate: sameDate, sm2_eFactor: 1.3 }),
        card_medium: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.0 }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result).toEqual(['card_hard', 'card_medium', 'card_easy']);
    });

    it('uses default eFactor 2.5 when eFactor is undefined', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 86400000);

      const sessionData: Records = {
        card_no_efactor: makeSession({ nextDueDate: sameDate, sm2_eFactor: undefined }),
        card_explicit_25: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.5 }),
        card_low_efactor: makeSession({ nextDueDate: sameDate, sm2_eFactor: 1.5 }),
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

      const sessionData: Records = {
        card_mature: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.5, sm2_repetitions: 10 }),
        card_new: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.5, sm2_repetitions: 0 }),
        card_mid: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.5, sm2_repetitions: 3 }),
      };

      const result = getDueCardUids(sessionData, false);
      expect(result).toEqual(['card_new', 'card_mid', 'card_mature']);
    });

    it('uses default repetitions 0 when undefined', () => {
      const now = new Date();
      const sameDate = new Date(now.getTime() - 86400000);

      const sessionData: Records = {
        card_no_reps: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.5, sm2_repetitions: undefined }),
        card_zero_reps: makeSession({ nextDueDate: sameDate, sm2_eFactor: 2.5, sm2_repetitions: 0 }),
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

      const sessionData: Records = {
        card_a: makeSession({ nextDueDate: threeDaysOverdue, sm2_eFactor: 2.8, sm2_repetitions: 10 }),
        card_b: makeSession({ nextDueDate: oneDayOverdue, sm2_eFactor: 1.3, sm2_repetitions: 0 }),
        card_c: makeSession({ nextDueDate: threeDaysOverdue, sm2_eFactor: 1.3, sm2_repetitions: 5 }),
        card_d: makeSession({ nextDueDate: threeDaysOverdue, sm2_eFactor: 1.3, sm2_repetitions: 1 }),
        card_e: makeSession({ nextDueDate: threeDaysOverdue, sm2_eFactor: 2.0, sm2_repetitions: 0 }),
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
