import * as practice from '~/practice';
import { ReviewModes } from '~/models/session';

describe('supermemo: simulate practice', () => {
  let initInput;
  let result;

  describe('Easy Path', () => {
    beforeAll(() => {
      initInput = {
        interval: 0,
        repetition: 0,
        efactor: 2.5,
      };
      result = undefined;
    });
    test('First practice', () => {
      result = practice.supermemo(initInput, 5);
      expect(result).toEqual({ efactor: 2.6, interval: 1, repetition: 1 });
    });

    test('Second practice', () => {
      result = practice.supermemo(result, 5);

      expect(result).toEqual({ efactor: 2.7, interval: 6, repetition: 2 });
    });

    test('Next practice', () => {
      result = practice.supermemo(result, 5);

      expect(result).toEqual({ efactor: 2.8000000000000003, interval: 16, repetition: 3 });
    });

    test('Next practice', () => {
      result = practice.supermemo(result, 5);

      expect(result).toEqual({ efactor: 2.9000000000000004, interval: 45, repetition: 4 });
    });

    test('Next practice', () => {
      result = practice.supermemo(result, 5);

      expect(result).toEqual({ efactor: 3.0000000000000004, interval: 131, repetition: 5 });
    });
  });

  describe('Regressions', () => {
    beforeEach(() => {
      initInput = { efactor: 3.0000000000000004, interval: 131, repetition: 5 };
      result = undefined;
    });

    test('Grade 0: Reset and review today', () => {
      result = practice.supermemo(initInput, 0);

      expect(result).toEqual({ efactor: 2.2000000000000006, interval: 0, repetition: 0 });
    });

    test('Grade 1: Review tomorrow', () => {
      result = practice.supermemo(initInput, 1);

      expect(result).toEqual({ efactor: 2.4600000000000004, interval: 1, repetition: 0 });
    });
  });

  describe('Relative', () => {
    const initInput = { efactor: 3.0000000000000004, interval: 131, repetition: 5 };
    const gradeResultsArr = new Array(6)

      .fill(undefined)
      .map((_, i) => ({ grade: i, ...practice.supermemo(initInput, i) }));

    const [result0, result1, result2, result3, result4, result5] = gradeResultsArr;

    test('Grade 0 should produce interval less all the rest', () => {
      const [result0, ...otherResults] = gradeResultsArr;

      for (const otherResult of otherResults) {
        expect(result0.interval).toBeLessThan(otherResult.interval);
      }
    });

    test('Grade 0 should be relative to Grade 1', () => {
      expect(result0.efactor).toBeLessThan(result1.efactor);
      expect(result0.interval).toBeLessThan(result1.interval);
    });

    test('1 and two both reset interval to 1 (review tomorrow)', () => {
      expect(result1.interval).toBe(1);
      expect(result2.interval).toBe(1);
    });

    test('Grade 1 should be relative to Grade 2', () => {
      expect(result1.efactor).toBeLessThan(result2.efactor);
    });

    test('Grade 2 should be relative to Grade 3', () => {
      expect(result2.efactor).toBeLessThan(result3.efactor);
      expect(result2.interval).toBeLessThan(result3.interval);
    });

    test('Grade 3 should be relative to Grade 4', () => {
      expect(result3.efactor).toBeLessThan(result4.efactor);
      expect(result3.interval).toBeLessThan(result4.interval);
    });

    test('Grade 4 should be relative to Grade 5', () => {
      expect(result4.efactor).toBeLessThan(result5.efactor);
      expect(result4.interval).toBeLessThan(result5.interval);
    });
  });

  describe('Progressive interval curve', () => {
    test('progressiveInterval produces correct schedule: 2, 6, 12, 24, 48, 96', () => {
      expect(practice.progressiveInterval(0)).toBe(2);
      expect(practice.progressiveInterval(1)).toBe(6);
      expect(practice.progressiveInterval(2)).toBe(12);
      expect(practice.progressiveInterval(3)).toBe(24);
      expect(practice.progressiveInterval(4)).toBe(48);
      expect(practice.progressiveInterval(5)).toBe(96);
    });

    test('progressiveInterval handles negative input as 0', () => {
      expect(practice.progressiveInterval(-1)).toBe(2);
    });
  });

  describe('Line-by-line metadata', () => {
    test('generatePracticeData does not pass through line-by-line fields (managed separately)', () => {
      const result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-14T00:00:00.000Z'),
        reviewMode: ReviewModes.SpacedInterval,
        grade: 5,
        interval: 0,
        repetitions: 0,
        eFactor: 2.5,
      });

      expect(result.lineByLineProgress).toBeUndefined();
      expect(result.reviewMode).toBe(ReviewModes.SpacedInterval);
    });
  });

  describe('Mode independence: Progressive mode must not pollute SM2 fields', () => {
    test('Progressive mode does not increment SM2 repetitions', () => {
      const result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.FixedProgressive,
        interval: 11,
        repetitions: 3,
        eFactor: 2.26,
        progressiveRepetitions: 1,
        intervalMultiplier: 2,
      });

      expect(result.repetitions).toBe(3);
      expect(result.progressiveRepetitions).toBe(2);
    });

    test('Progressive mode inherits SM2 interval and eFactor unchanged', () => {
      const result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.FixedProgressive,
        interval: 11,
        repetitions: 3,
        eFactor: 2.26,
        progressiveRepetitions: 1,
        intervalMultiplier: 2,
      });

      expect(result.interval).toBe(11);
      expect(result.eFactor).toBe(2.26);
    });

    test('Progressive mode does not write SM2 fields when they are undefined', () => {
      const result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.FixedProgressive,
        progressiveRepetitions: 0,
      });

      expect(result.interval).toBeUndefined();
      expect(result.repetitions).toBeUndefined();
      expect(result.eFactor).toBeUndefined();
      expect(result.progressiveRepetitions).toBe(1);
    });
  });

  describe('Mode independence: SM2 mode preserves Progressive fields', () => {
    test('SM2 mode inherits progressiveRepetitions and intervalMultiplier', () => {
      const result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.SpacedInterval,
        grade: 4,
        interval: 6,
        repetitions: 2,
        eFactor: 2.26,
        progressiveRepetitions: 3,
        intervalMultiplier: 12,
      });

      expect(result.progressiveRepetitions).toBe(3);
      expect(result.intervalMultiplier).toBe(12);
      expect(result.repetitions).toBe(3);
      expect(result.interval).toBe(11);
    });

    test('SM2 mode does not write Progressive fields when they are undefined', () => {
      const result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.SpacedInterval,
        grade: 5,
        interval: 0,
        repetitions: 0,
        eFactor: 2.5,
      });

      expect(result.progressiveRepetitions).toBeUndefined();
      expect(result.intervalMultiplier).toBeUndefined();
    });
  });

  describe('Mode switching: full field inheritance across mode switches', () => {
    test('Switching SM2 → Progressive preserves SM2 fields', () => {
      const sm2Result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.SpacedInterval,
        grade: 4,
        interval: 6,
        repetitions: 2,
        eFactor: 2.26,
      });

      const progResult = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.FixedProgressive,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        eFactor: sm2Result.eFactor,
        progressiveRepetitions: sm2Result.progressiveRepetitions,
        intervalMultiplier: sm2Result.intervalMultiplier,
      });

      expect(progResult.interval).toBe(sm2Result.interval);
      expect(progResult.repetitions).toBe(sm2Result.repetitions);
      expect(progResult.eFactor).toBe(sm2Result.eFactor);
      expect(progResult.progressiveRepetitions).toBe(1);
    });

    test('Mode switches preserve lineByLineProgress snapshot', () => {
      const lineByLineProgress = JSON.stringify({
        'child-1': {
          nextDueDate: '2026-04-20T00:00:00.000Z',
          interval: 6,
          repetitions: 2,
          eFactor: 2.5,
          progressiveRepetitions: 1,
        },
      });

      const progResult = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.FixedProgressive,
        interval: 11,
        repetitions: 3,
        eFactor: 2.26,
        progressiveRepetitions: 2,
        intervalMultiplier: 12,
        lineByLineProgress,
      });

      expect(progResult.lineByLineProgress).toBe(lineByLineProgress);

      const sm2Result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.SpacedInterval,
        grade: 4,
        interval: progResult.interval,
        repetitions: progResult.repetitions,
        eFactor: progResult.eFactor,
        progressiveRepetitions: progResult.progressiveRepetitions,
        intervalMultiplier: progResult.intervalMultiplier,
        lineByLineProgress: progResult.lineByLineProgress,
      });

      expect(sm2Result.lineByLineProgress).toBe(lineByLineProgress);
    });

    test('Switching Progressive → SM2 preserves Progressive fields', () => {
      const progResult = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.FixedProgressive,
        interval: 11,
        repetitions: 3,
        eFactor: 2.26,
        progressiveRepetitions: 2,
        intervalMultiplier: 12,
      });

      const sm2Result = practice.generatePracticeData({
        dateCreated: new Date('2026-04-15T00:00:00.000Z'),
        reviewMode: ReviewModes.SpacedInterval,
        grade: 4,
        interval: progResult.interval,
        repetitions: progResult.repetitions,
        eFactor: progResult.eFactor,
        progressiveRepetitions: progResult.progressiveRepetitions,
        intervalMultiplier: progResult.intervalMultiplier,
      });

      expect(sm2Result.progressiveRepetitions).toBe(3);
      expect(sm2Result.intervalMultiplier).toBe(12);
      expect(sm2Result.repetitions).toBe(4);
    });
  });
});
