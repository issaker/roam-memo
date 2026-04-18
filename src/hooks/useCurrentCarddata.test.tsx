import { act, renderHook } from '@testing-library/react-hooks';
import useCurrentCardData from './useCurrentCardData';
import { generateNewSession } from '~/queries';
import { SchedulingAlgorithm, InteractionStyle } from '~/models/session';
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

  it('initializes cardMeta from latestSession algorithm', async () => {
    const currentCardRefUid = 'card-spaced';
    const session = generateNewSession({
      algorithm: SchedulingAlgorithm.SM2,
      interaction: InteractionStyle.NORMAL,
      isNew: false,
    });

    const sessions = [session];

    const { result } = renderHook(() =>
      useCurrentCardData({
        sessions,
        currentCardRefUid,
      })
    );

    expect(result.current.algorithm).toEqual(SchedulingAlgorithm.SM2);
    expect(result.current.cardMeta?.algorithm).toEqual(SchedulingAlgorithm.SM2);
  });

  it('algorithm falls back to DEFAULT when latestSession has no algorithm', async () => {
    const currentCardRefUid = 'id_empty';

    const { result } = renderHook(() =>
      useCurrentCardData({
        sessions: [],
        currentCardRefUid,
      })
    );

    expect(result.current.algorithm).toEqual(SchedulingAlgorithm.SM2);
  });

  describe('Card navigation', () => {
    it('Updates state when switching to next cards', async () => {
      const currentCardRefUid_0 = 'id_0';
      const currentCardRefUid_1 = 'id_1';
      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid_0 })
        .withSession(currentCardRefUid_0, {
          algorithm: SchedulingAlgorithm.SM2,
          interaction: InteractionStyle.NORMAL,
        })
        .withCard({ uid: currentCardRefUid_1 })
        .withSession(currentCardRefUid_1, {
          sm2_grade: 2,
          algorithm: SchedulingAlgorithm.PROGRESSIVE,
          interaction: InteractionStyle.NORMAL,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();
      const { result } = renderHook(() => {
        const [currentCardRefUid, setCurrentCardRefUid] = React.useState(currentCardRefUid_0);
        const { algorithm, cardMeta, currentCardData } = useCurrentCardData({
          sessions: [practiceData[currentCardRefUid]],
          currentCardRefUid: currentCardRefUid,
        });

        return {
          algorithm,
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
        algorithm: SchedulingAlgorithm.PROGRESSIVE,
      });
      expect(result.current.algorithm).toEqual(SchedulingAlgorithm.PROGRESSIVE);
    });

    it('Returns latestSession derived from sessions', async () => {
      const currentCardRefUid = 'id_0';
      const mockBuilder = new testUtils.MockDataBuilder()
        .withCard({ uid: currentCardRefUid })
        .withSession(currentCardRefUid, {
          sm2_grade: 1,
          algorithm: SchedulingAlgorithm.SM2,
          interaction: InteractionStyle.NORMAL,
        })
        .withSession(currentCardRefUid, {
          sm2_grade: 2,
          algorithm: SchedulingAlgorithm.PROGRESSIVE,
          interaction: InteractionStyle.NORMAL,
        });

      mockBuilder.mockQueryResults();
      const { practiceData } = await mockBuilder.getPracticeData();

      const { result } = renderHook(() =>
        useCurrentCardData({ sessions: [practiceData[currentCardRefUid]], currentCardRefUid })
      );

      expect(result.current.latestSession).toBeDefined();
      expect(result.current.latestSession!.algorithm).toEqual(SchedulingAlgorithm.PROGRESSIVE);
    });
  });

  describe('Card meta initialization', () => {
    it('cardMeta is initialized from latestSession with LBL mode', async () => {
      const currentCardRefUid = 'id_lbl';
      const session = {
        ...generateNewSession({
          algorithm: SchedulingAlgorithm.SM2,
          interaction: InteractionStyle.LBL,
          isNew: false,
        }),
      };

      const { result } = renderHook(() =>
        useCurrentCardData({
          sessions: [session],
          currentCardRefUid,
        })
      );

      expect(result.current.cardMeta?.interaction).toEqual(InteractionStyle.LBL);
      expect(result.current.interaction).toEqual(InteractionStyle.LBL);
    });

    it('applyOptimisticCardMeta updates cardMeta immediately', async () => {
      const currentCardRefUid = 'id_opt';
      const session = generateNewSession({
        algorithm: SchedulingAlgorithm.PROGRESSIVE,
        interaction: InteractionStyle.NORMAL,
        isNew: false,
      });

      const { result } = renderHook(() =>
        useCurrentCardData({
          sessions: [session],
          currentCardRefUid,
        })
      );

      expect(result.current.algorithm).toEqual(SchedulingAlgorithm.PROGRESSIVE);

      act(() => {
        result.current.applyOptimisticCardMeta({
          algorithm: SchedulingAlgorithm.SM2,
          interaction: InteractionStyle.NORMAL,
          lbl_progress: undefined,
        });
      });

      expect(result.current.cardMeta?.algorithm).toEqual(SchedulingAlgorithm.SM2);
      expect(result.current.algorithm).toEqual(SchedulingAlgorithm.SM2);
    });
  });
});
