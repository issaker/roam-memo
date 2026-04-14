import { act, renderHook } from '@testing-library/react-hooks';
import useCurrentCardData from './useCurrentCardData';
import { generateNewSession } from '~/queries';
import { IntervalMultiplierType, NewSession, ReviewModes, Session } from '~/models/session';
import * as testUtils from '~/utils/testUtils';
import React from 'react';

describe('useCurrentCardData', () => {
  const originalLocation = window;

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(globalThis, 'window', {
      value: originalLocation,
    });
  });

  it('should return current card when review mode unchanged', async () => {
    const currentCardRefUid = 'id_0';
    const currentCardData = generateNewSession({ isNew: false });
    const practiceData = {
      [currentCardRefUid]: [currentCardData],
    };

    const { result } = renderHook(() =>
      useCurrentCardData({ sessions: practiceData[currentCardRefUid], currentCardRefUid })
    );

    expect(result.current.currentCardData).toEqual(currentCardData);
  });

  it('returns undefined when currentCardRefUid is undefined (on complete)', () => {
    const currentCardRefUid = undefined;
    const practiceData = {};

    const { result } = renderHook(() =>
      useCurrentCardData({
        sessions: currentCardRefUid ? practiceData[currentCardRefUid] : [],
        currentCardRefUid,
      })
    );

    expect(result.current.currentCardData).toEqual(undefined);
  });

  it('returns undefined when currentCardRefUid becomes undefined (on complete)', async () => {
    const { result } = renderHook(() => {
      const [currentCardRefUid, setCurrentCardRefUid] = React.useState<string | undefined>('id_0');
      const currentCardData = generateNewSession({ isNew: false });
      const practiceData = {
        ['id_0']: [currentCardData],
      };
      const { currentCardData: currentCardDataResult } = useCurrentCardData({
        sessions: currentCardRefUid ? practiceData[currentCardRefUid] : [],
        currentCardRefUid,
      });

      return {
        currentCardData: currentCardDataResult,
        setCurrentCardRefUid,
      };
    });

    act(() => {
      result.current.setCurrentCardRefUid(undefined);
    });

    expect(result.current.currentCardData).toEqual(undefined);
  });

  describe('When review mode changed', () => {
    it('Return new session when no matching one exists', async () => {
      const currentCardRefUid = 'id_0';
      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid })
        .withSession(currentCardRefUid, {
          reviewMode: ReviewModes.DefaultSpacedInterval,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();
      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: practiceData[currentCardRefUid], currentCardRefUid })
      );

      act(() => {
        result.current.setReviewModeOverride(ReviewModes.FixedInterval);
      });

      const resultData = result.current.currentCardData as NewSession;
      expect(resultData.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(resultData.isNew).toBe(true);
    });

    it('Returns first matching existing session when available', async () => {
      const currentCardRefUid = 'id_0';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid })
        .withSession(currentCardRefUid, {
          reviewMode: ReviewModes.FixedInterval,
          grade: 1,
        })
        .withSession(currentCardRefUid, {
          reviewMode: ReviewModes.FixedInterval,
          grade: 2,
        })
        .withSession(currentCardRefUid, {
          reviewMode: ReviewModes.DefaultSpacedInterval,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();
      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: practiceData[currentCardRefUid], currentCardRefUid })
      );

      act(() => {
        result.current.setReviewModeOverride(ReviewModes.FixedInterval);
      });

      const resultData = result.current.currentCardData as Session;
      expect(resultData.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(resultData.grade).toEqual(2);
      expect((resultData as NewSession).isNew).toBe(false);
    });

    it('Can switch back to original card', async () => {
      const currentCardRefUid = 'id_0';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid })
        .withSession(currentCardRefUid, {
          reviewMode: ReviewModes.DefaultSpacedInterval,
          grade: 2,
        })
        .withSession(currentCardRefUid, {
          reviewMode: ReviewModes.FixedInterval,
          grade: 1,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: practiceData[currentCardRefUid], currentCardRefUid })
      );

      act(() => {
        result.current.setReviewModeOverride(ReviewModes.DefaultSpacedInterval);
      });

      let resultData = result.current.currentCardData as Session | undefined;
      expect(resultData?.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);
      expect(resultData).toMatchObject({
        reviewMode: ReviewModes.DefaultSpacedInterval,
        grade: 2,
        isNew: false,
      });

      act(() => {
        result.current.setReviewModeOverride(ReviewModes.FixedInterval);
      });

      resultData = result.current.currentCardData;
      expect(resultData?.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(resultData).toMatchObject({
        reviewMode: ReviewModes.FixedInterval,
        grade: 1,
      });

      act(() => {
        result.current.setReviewModeOverride(ReviewModes.DefaultSpacedInterval);
      });

      resultData = result.current.currentCardData as Session;
      expect(resultData.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);
      expect(resultData).toMatchObject({
        reviewMode: ReviewModes.DefaultSpacedInterval,
        grade: 2,
        isNew: false,
      });
    });

    it('Preserves line-by-line metadata when switching review modes', async () => {
      const currentCardRefUid = 'id_lbl';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid })
        .withSession(currentCardRefUid, {
          reviewMode: ReviewModes.FixedInterval,
          lineByLineReview: 'Y',
          lineByLineProgress: '{"child-1":{"interval":1}}',
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: practiceData[currentCardRefUid], currentCardRefUid })
      );

      act(() => {
        result.current.setReviewModeOverride(ReviewModes.DefaultSpacedInterval);
      });

      expect(result.current.currentCardData).toMatchObject({
        reviewMode: ReviewModes.DefaultSpacedInterval,
        lineByLineReview: 'Y',
        lineByLineProgress: '{"child-1":{"interval":1}}',
      });
    });

    it('Updates state when switching to next cards', async () => {
      const currentCardRefUid_0 = 'id_0';
      const currentCardRefUid_1 = 'id_1';
      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid_0 })
        .withSession(currentCardRefUid_0, {
          reviewMode: ReviewModes.DefaultSpacedInterval,
        })
        .withCard({ uid: currentCardRefUid_1 })
        .withSession(currentCardRefUid_1, {
          grade: 2,
          reviewMode: ReviewModes.FixedInterval,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();
      const { result } = renderHook(() => {
        const [currentCardRefUid, setCurrentCardRefUid] = React.useState(currentCardRefUid_0);
        const { reviewMode, setReviewModeOverride, currentCardData } = useCurrentCardData({
          sessions: practiceData[currentCardRefUid],
          currentCardRefUid: currentCardRefUid,
        });

        return {
          reviewMode,
          setReviewModeOverride,
          currentCardData,
          currentCardRefUid,
          setCurrentCardRefUid,
        };
      });

      act(() => {
        // Switch to next card
        result.current.setCurrentCardRefUid(currentCardRefUid_1);
      });

      expect(result.current.currentCardData).toMatchObject({
        refUid: currentCardRefUid_1,
        reviewMode: ReviewModes.FixedInterval,
        grade: 2,
      });
      expect(result.current.reviewMode).toEqual(ReviewModes.FixedInterval);
    });

    it('Updates state when switching to next card after first switching review mode', async () => {
      const originalCurrentCardRefUid = 'id_0';
      const nextCardRefUid = 'id_1';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: originalCurrentCardRefUid })
        .withSession(originalCurrentCardRefUid, {
          grade: 1,
          reviewMode: ReviewModes.DefaultSpacedInterval,
        })
        .withSession(originalCurrentCardRefUid, {
          reviewMode: ReviewModes.FixedInterval,
        })
        .withCard({ uid: nextCardRefUid })
        .withSession(nextCardRefUid, {
          grade: 2,
          reviewMode: ReviewModes.FixedInterval,
        });

      mockBuilder.mockQueryResults();

      const { practiceData } = await mockBuilder.getPracticeData();
      const { result } = renderHook(() => {
        const [currentCardRefUid, setCurrentCardRefUid] = React.useState(originalCurrentCardRefUid);
        const { reviewMode, setReviewModeOverride, currentCardData } = useCurrentCardData({
          sessions: practiceData[currentCardRefUid],
          currentCardRefUid: currentCardRefUid,
        });

        return {
          reviewMode,
          setReviewModeOverride,
          currentCardData,
          currentCardRefUid,
          setCurrentCardRefUid,
        };
      });

      act(() => {
        // Switch to fixed
        result.current.setReviewModeOverride(ReviewModes.FixedInterval);
      });

      const resultData = result.current.currentCardData as Session;
      expect(resultData.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect((resultData as NewSession).isNew).toBe(false);

      act(() => {
        // Switch back
        result.current.setReviewModeOverride(ReviewModes.DefaultSpacedInterval);
      });

      expect(result.current.currentCardData).toMatchObject({
        refUid: originalCurrentCardRefUid,
        reviewMode: ReviewModes.DefaultSpacedInterval,
        grade: 1,
      });

      act(() => {
        // Switch to next card
        result.current.setCurrentCardRefUid(nextCardRefUid);
      });

      expect(result.current.currentCardData).toMatchObject({
        refUid: nextCardRefUid,
        reviewMode: ReviewModes.FixedInterval,
        grade: 2,
      });
    });

    it('Clears reviewModeOverride on card navigation to prevent mode inheritance', async () => {
      const cardAUid = 'card_progressive';
      const cardBUid = 'card_spaced';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: cardAUid })
        .withSession(cardAUid, {
          grade: 3,
          reviewMode: ReviewModes.FixedInterval,
          intervalMultiplierType: IntervalMultiplierType.Progressive,
        })
        .withCard({ uid: cardBUid })
        .withSession(cardBUid, {
          grade: 4,
          reviewMode: ReviewModes.DefaultSpacedInterval,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() => {
        const [currentCardRefUid, setCurrentCardRefUid] = React.useState(cardAUid);
        const { reviewMode, setReviewModeOverride, currentCardData } = useCurrentCardData({
          sessions: practiceData[currentCardRefUid],
          currentCardRefUid,
        });

        return {
          reviewMode,
          setReviewModeOverride,
          currentCardData,
          currentCardRefUid,
          setCurrentCardRefUid,
        };
      });

      expect(result.current.reviewMode).toEqual(ReviewModes.FixedInterval);

      act(() => {
        result.current.setReviewModeOverride(ReviewModes.DefaultSpacedInterval);
      });

      expect(result.current.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);

      act(() => {
        result.current.setCurrentCardRefUid(cardBUid);
      });

      expect(result.current.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);
      expect(result.current.currentCardData).toMatchObject({
        refUid: cardBUid,
        reviewMode: ReviewModes.DefaultSpacedInterval,
      });
    });

    it('Returns latestSession derived from sessions', async () => {
      const currentCardRefUid = 'id_0';
      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid })
        .withSession(currentCardRefUid, {
          grade: 1,
          reviewMode: ReviewModes.DefaultSpacedInterval,
        })
        .withSession(currentCardRefUid, {
          grade: 2,
          reviewMode: ReviewModes.FixedInterval,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: practiceData[currentCardRefUid], currentCardRefUid })
      );

      expect(result.current.latestSession).toBeDefined();
      expect(result.current.latestSession!.reviewMode).toEqual(ReviewModes.FixedInterval);
    });
  });

  describe('Review mode isolation between cards', () => {
    it('Progressive card followed by SPACED_INTERVAL card loads correct mode', async () => {
      const progressiveCardUid = 'card_progressive';
      const spacedCardUid = 'card_spaced';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: progressiveCardUid })
        .withSession(progressiveCardUid, {
          grade: 3,
          reviewMode: ReviewModes.FixedInterval,
          intervalMultiplierType: IntervalMultiplierType.Progressive,
        })
        .withCard({ uid: spacedCardUid })
        .withSession(spacedCardUid, {
          grade: 4,
          reviewMode: ReviewModes.DefaultSpacedInterval,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() => {
        const [currentCardRefUid, setCurrentCardRefUid] = React.useState(progressiveCardUid);
        const { reviewMode, currentCardData } = useCurrentCardData({
          sessions: practiceData[currentCardRefUid],
          currentCardRefUid,
        });

        return {
          reviewMode,
          currentCardData,
          currentCardRefUid,
          setCurrentCardRefUid,
        };
      });

      expect(result.current.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(result.current.currentCardData?.intervalMultiplierType).toEqual(
        IntervalMultiplierType.Progressive
      );

      act(() => {
        result.current.setCurrentCardRefUid(spacedCardUid);
      });

      expect(result.current.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);
      expect(result.current.currentCardData).toMatchObject({
        refUid: spacedCardUid,
        reviewMode: ReviewModes.DefaultSpacedInterval,
      });
    });

    it('Multiple cards with different modes switch correctly', async () => {
      const cardAUid = 'card_a_progressive';
      const cardBUid = 'card_b_spaced';
      const cardCUid = 'card_c_days';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: cardAUid })
        .withSession(cardAUid, {
          grade: 3,
          reviewMode: ReviewModes.FixedInterval,
          intervalMultiplierType: IntervalMultiplierType.Progressive,
        })
        .withCard({ uid: cardBUid })
        .withSession(cardBUid, {
          grade: 4,
          reviewMode: ReviewModes.DefaultSpacedInterval,
        })
        .withCard({ uid: cardCUid })
        .withSession(cardCUid, {
          grade: 2,
          reviewMode: ReviewModes.FixedInterval,
          intervalMultiplierType: IntervalMultiplierType.Days,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() => {
        const [currentCardRefUid, setCurrentCardRefUid] = React.useState(cardAUid);
        const { reviewMode, currentCardData } = useCurrentCardData({
          sessions: practiceData[currentCardRefUid],
          currentCardRefUid,
        });

        return {
          reviewMode,
          currentCardData,
          currentCardRefUid,
          setCurrentCardRefUid,
        };
      });

      expect(result.current.reviewMode).toEqual(ReviewModes.FixedInterval);

      act(() => {
        result.current.setCurrentCardRefUid(cardBUid);
      });
      expect(result.current.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);

      act(() => {
        result.current.setCurrentCardRefUid(cardCUid);
      });
      expect(result.current.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(result.current.currentCardData?.intervalMultiplierType).toEqual(
        IntervalMultiplierType.Days
      );
    });

    it('Review history consistency with actual review mode', async () => {
      const cardUid = 'card_history_test';

      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: cardUid })
        .withSession(cardUid, {
          grade: 1,
          reviewMode: ReviewModes.FixedInterval,
          intervalMultiplierType: IntervalMultiplierType.Progressive,
        })
        .withSession(cardUid, {
          grade: 2,
          reviewMode: ReviewModes.DefaultSpacedInterval,
        })
        .withSession(cardUid, {
          grade: 3,
          reviewMode: ReviewModes.FixedInterval,
          intervalMultiplierType: IntervalMultiplierType.Days,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: practiceData[cardUid], currentCardRefUid: cardUid })
      );

      expect(result.current.latestSession!.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(result.current.latestSession!.intervalMultiplierType).toEqual(
        IntervalMultiplierType.Days
      );
      expect(result.current.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(result.current.currentCardData?.reviewMode).toEqual(ReviewModes.FixedInterval);
      expect(result.current.currentCardData?.intervalMultiplierType).toEqual(
        IntervalMultiplierType.Days
      );
    });

  });
});
