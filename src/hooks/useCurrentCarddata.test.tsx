import { act, renderHook } from '@testing-library/react-hooks';
import useCurrentCardData from './useCurrentCardData';
import { generateNewSession } from '~/queries';
import { CardType, ReviewModes } from '~/models/session';
import * as testUtils from '~/utils/testUtils';
import React from 'react';

describe('useCurrentCardData', () => {
  const originalLocation = window;
  const parseMockRoamDate = (value: string) => {
    if (!value || value.split(' ').length < 3) return undefined;
    const months = {
      January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
      July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
    };
    const [month, dayWithSuffix, year] = value.replace(',', '').split(' ');
    if (!(month in months) || !dayWithSuffix || !year) return undefined;
    const day = Number(dayWithSuffix.replace(/(st|nd|rd|th)$/, ''));
    return new Date(Date.UTC(Number(year), months[month as keyof typeof months], day));
  };

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

  it('polling infers SPACED_INTERVAL from live SM2 fields when reviewMode is missing', async () => {
    const currentCardRefUid = 'card-live-spaced';
    const staleQueueSession = generateNewSession({
      reviewMode: ReviewModes.FixedInterval,
      isNew: false,
    });

    const sessions = [staleQueueSession];

    Object.defineProperty(window, 'roamAlphaAPI', {
      value: {
        q: jest.fn(() => [
          [
            {
              children: [
                {
                  string: `((${currentCardRefUid}))`,
                  children: [
                    {
                      string: 'meta',
                      order: 0,
                      children: [],
                    },
                    {
                      string: '[[April 14th, 2026]] 🟢',
                      order: 0,
                      children: [
                        { string: 'repetitions:: 2' },
                        { string: 'interval:: 6' },
                        { string: 'eFactor:: 2.3' },
                        { string: 'nextDueDate:: [[April 20th, 2026]]' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        ]),
        util: {
          pageTitleToDate: jest.fn((value: string) => parseMockRoamDate(value)),
        },
      },
      writable: true,
    });

    const { result } = renderHook(() =>
      useCurrentCardData({
        sessions,
        currentCardRefUid,
        dataPageTitle: 'roam/memo',
      })
    );

    expect(result.current.reviewMode).toEqual(ReviewModes.FixedInterval);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });

    expect(result.current.currentCardData).toMatchObject({
      reviewMode: ReviewModes.DefaultSpacedInterval,
      repetitions: 2,
      interval: 6,
      eFactor: 2.3,
    });
  });

  it('reviewMode is derived from cardMeta.cardType', async () => {
    const currentCardRefUid = 'id_cardtype';

    Object.defineProperty(window, 'roamAlphaAPI', {
      value: {
        q: jest.fn(() => [
          [
            {
              children: [
                {
                  string: `((${currentCardRefUid}))`,
                  children: [
                    {
                      string: 'meta',
                      order: 0,
                      children: [
                        { string: 'cardType:: SPACED_INTERVAL' },
                      ],
                    },
                    {
                      string: '[[April 14th, 2026]] 🟢',
                      order: 0,
                      children: [
                        { string: 'reviewMode:: SPACED_INTERVAL' },
                        { string: 'repetitions:: 1' },
                        { string: 'interval:: 1' },
                        { string: 'eFactor:: 2.5' },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        ]),
        util: {
          pageTitleToDate: jest.fn((value: string) => parseMockRoamDate(value)),
        },
      },
      writable: true,
    });

    const { result } = renderHook(() =>
      useCurrentCardData({
        sessions: [],
        currentCardRefUid,
        dataPageTitle: 'roam/memo',
      })
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });

    expect(result.current.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);
    expect(result.current.cardMeta?.cardType).toEqual(CardType.SpacedInterval);
  });

  describe('Card navigation', () => {
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
        refUid: currentCardRefUid_1,
        reviewMode: ReviewModes.FixedInterval,
        grade: 2,
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

  describe('Card meta integration', () => {
    it('cardMeta reflects LBL state from polling data', async () => {
      const currentCardRefUid = 'id_lbl';

      Object.defineProperty(window, 'roamAlphaAPI', {
        value: {
          q: jest.fn(() => [
            [
              {
                children: [
                  {
                    string: `((${currentCardRefUid}))`,
                    children: [
                      {
                        string: 'meta',
                        order: 0,
                        children: [
                          { string: 'cardType:: SPACED_INTERVAL_LBL' },
                          { string: 'lineByLineReview:: Y' },
                        ],
                      },
                      {
                        string: '[[April 14th, 2026]] 🟢',
                        order: 0,
                        children: [
                          { string: 'reviewMode:: SPACED_INTERVAL' },
                          { string: 'repetitions:: 1' },
                          { string: 'interval:: 1' },
                          { string: 'eFactor:: 2.5' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          ]),
          util: {
            pageTitleToDate: jest.fn((value: string) => parseMockRoamDate(value)),
          },
        },
        writable: true,
      });

      const { result } = renderHook(() =>
        useCurrentCardData({
          sessions: [],
          currentCardRefUid,
          dataPageTitle: 'roam/memo',
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      });

      expect(result.current.cardMeta?.lineByLineReview).toEqual('Y');
      expect(result.current.cardMeta?.cardType).toEqual(CardType.SpacedIntervalLineByLine);
      expect(result.current.reviewMode).toEqual(ReviewModes.DefaultSpacedInterval);
    });
  });
});
