import { act, renderHook } from '@testing-library/react-hooks';
import useCurrentCardData from './useCurrentCardData';
import { generateNewSession } from '~/queries';
import { ReviewModes } from '~/models/session';
import * as testUtils from '~/utils/testUtils';
import React from 'react';

describe('useCurrentCardData', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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

  it('initializes cardMeta from latestSession reviewMode', async () => {
    const currentCardRefUid = 'card-spaced';
    const session = generateNewSession({
      reviewMode: ReviewModes.SpacedInterval,
      isNew: false,
    });

    const sessions = [session];

    const { result } = renderHook(() =>
      useCurrentCardData({
        sessions,
        currentCardRefUid,
      })
    );

    expect(result.current.reviewMode).toEqual(ReviewModes.SpacedInterval);
    expect(result.current.cardMeta?.reviewMode).toEqual(ReviewModes.SpacedInterval);
  });

  it('reviewMode falls back to DEFAULT when latestSession has no reviewMode', async () => {
    const currentCardRefUid = 'id_empty';

    const { result } = renderHook(() =>
      useCurrentCardData({
        sessions: [],
        currentCardRefUid,
      })
    );

    expect(result.current.reviewMode).toEqual(ReviewModes.FixedProgressive);
  });

  describe('Card navigation', () => {
    it('Updates state when switching to next cards', async () => {
      const currentCardRefUid_0 = 'id_0';
      const currentCardRefUid_1 = 'id_1';
      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid_0 })
        .withSession(currentCardRefUid_0, {
          reviewMode: ReviewModes.SpacedInterval,
        })
        .withCard({ uid: currentCardRefUid_1 })
        .withSession(currentCardRefUid_1, {
          grade: 2,
          reviewMode: ReviewModes.FixedProgressive,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();
      const { result } = renderHook(() => {
        const [currentCardRefUid, setCurrentCardRefUid] = React.useState(currentCardRefUid_0);
        const { reviewMode, cardMeta, currentCardData } = useCurrentCardData({
          sessions: practiceData[currentCardRefUid],
          currentCardRefUid: currentCardRefUid,
        });

        return {
          reviewMode,
          cardMeta,
          currentCardData,
          currentCardRefUid,
          setCurrentCardRefUid,
        };
      });

      act(() => {
        result.current.setCurrentCardRefUid(currentCardRefUid_1);
      });

      expect(result.current.currentCardData).toMatchObject({
        reviewMode: ReviewModes.FixedProgressive,
      });
      expect(result.current.reviewMode).toEqual(ReviewModes.FixedProgressive);
    });

    it('Returns latestSession derived from sessions', async () => {
      const currentCardRefUid = 'id_0';
      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid })
        .withSession(currentCardRefUid, {
          grade: 1,
          reviewMode: ReviewModes.SpacedInterval,
        })
        .withSession(currentCardRefUid, {
          grade: 2,
          reviewMode: ReviewModes.FixedProgressive,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: practiceData[currentCardRefUid], currentCardRefUid })
      );

      expect(result.current.latestSession).toBeDefined();
      expect(result.current.latestSession!.reviewMode).toEqual(ReviewModes.FixedProgressive);
    });
  });

  describe('Card meta initialization', () => {
    it('cardMeta is initialized from latestSession with LBL mode', async () => {
      const currentCardRefUid = 'id_lbl';
      const session = {
        ...generateNewSession({ reviewMode: ReviewModes.SpacedIntervalLBL, isNew: false }),
      };

      const { result } = renderHook(() =>
        useCurrentCardData({
          sessions: [session],
          currentCardRefUid,
        })
      );

      expect(result.current.cardMeta?.reviewMode).toEqual(ReviewModes.SpacedIntervalLBL);
      expect(result.current.reviewMode).toEqual(ReviewModes.SpacedIntervalLBL);
    });

    it('applyOptimisticCardMeta updates cardMeta immediately', async () => {
      const currentCardRefUid = 'id_opt';
      const session = generateNewSession({
        reviewMode: ReviewModes.FixedProgressive,
        isNew: false,
      });

      const { result } = renderHook(() =>
        useCurrentCardData({
          sessions: [session],
          currentCardRefUid,
        })
      );

      expect(result.current.reviewMode).toEqual(ReviewModes.FixedProgressive);

      act(() => {
        result.current.applyOptimisticCardMeta({
          reviewMode: ReviewModes.SpacedInterval,
          lineByLineProgress: undefined,
        });
      });

      expect(result.current.cardMeta?.reviewMode).toEqual(ReviewModes.SpacedInterval);
      expect(result.current.reviewMode).toEqual(ReviewModes.SpacedInterval);
    });
  });
});
