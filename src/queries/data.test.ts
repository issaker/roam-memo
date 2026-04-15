import { getPluginPageBlockDataQuery, getPluginPageData, inferReviewModeFromFields } from '~/queries/data';

const parseMockRoamDate = (value: string) => {
  if (!value || value.split(' ').length < 3) return undefined;
  const months = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11,
  };
  const [month, dayWithSuffix, year] = value.replace(',', '').split(' ');
  if (!(month in months) || !dayWithSuffix || !year) return undefined;
  const day = Number(dayWithSuffix.replace(/(st|nd|rd|th)$/, ''));
  return new Date(Date.UTC(Number(year), months[month as keyof typeof months], day));
};

describe('getPluginPageData', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads all fields from the latest session block', async () => {
    Object.defineProperty(window, 'roamAlphaAPI', {
      value: {
        q: jest.fn(() => [
          [
            {
              children: [
                {
                  string: '((card-1))',
                  children: [
                    {
                      string: '[[April 14th, 2026]] 🟢',
                      order: 0,
                      children: [
                        { string: 'reviewMode:: SPACED_INTERVAL' },
                        { string: 'lineByLineProgress:: {"child-1":{"interval":6}}' },
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

    const result = await getPluginPageData({
      dataPageTitle: 'roam/memo',
      limitToLatest: true,
    });

    expect(window.roamAlphaAPI.q).toHaveBeenCalledWith(
      getPluginPageBlockDataQuery,
      'roam/memo',
      'data'
    );
    expect(result['card-1']).toMatchObject({
      reviewMode: 'SPACED_INTERVAL',
      lineByLineProgress: '{"child-1":{"interval":6}}',
    });
    const cardData = result['card-1'] as any;
    expect(cardData.nextDueDate).toEqual(new Date('2026-04-20T00:00:00.000Z'));
  });

  it('reads reviewMode from latest session block', async () => {
    Object.defineProperty(window, 'roamAlphaAPI', {
      value: {
        q: jest.fn(() => [
          [
            {
              children: [
                {
                  string: '((card-spaced))',
                  children: [
                    {
                      string: '[[April 14th, 2026]] 🟢',
                      order: 0,
                      children: [
                        { string: 'reviewMode:: SPACED_INTERVAL' },
                        { string: 'repetitions:: 3' },
                        { string: 'interval:: 12' },
                        { string: 'eFactor:: 2.4' },
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

    const result = await getPluginPageData({
      dataPageTitle: 'roam/memo',
      limitToLatest: true,
    });

    expect(result['card-spaced']).toMatchObject({
      reviewMode: 'SPACED_INTERVAL',
      repetitions: 3,
      interval: 12,
      eFactor: 2.4,
    });
  });

  it('returns no reviewMode when session block has none', async () => {
    Object.defineProperty(window, 'roamAlphaAPI', {
      value: {
        q: jest.fn(() => [
          [
            {
              children: [
                {
                  string: '((card-fixed))',
                  children: [
                    {
                      string: '[[April 14th, 2026]] 🟢',
                      order: 0,
                      children: [{ string: 'nextDueDate:: [[April 20th, 2026]]' }],
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

    const result = await getPluginPageData({
      dataPageTitle: 'roam/memo',
      limitToLatest: true,
    });

    expect(result['card-fixed']).toMatchObject({
      dateCreated: new Date('2026-04-14T00:00:00.000Z'),
      nextDueDate: new Date('2026-04-20T00:00:00.000Z'),
    });
    expect((result['card-fixed'] as any).reviewMode).toBeUndefined();
  });
});

describe('inferReviewModeFromFields', () => {
  it('infers SPACED_INTERVAL from SM2 fields', () => {
    expect(inferReviewModeFromFields({ repetitions: 3, interval: 12, eFactor: 2.4 }))
      .toBe('SPACED_INTERVAL');
  });

  it('infers FIXED_PROGRESSIVE from fixed-mode fields', () => {
    expect(inferReviewModeFromFields({ intervalMultiplier: 3 }))
      .toBe('FIXED_PROGRESSIVE');
  });

  it('returns FIXED_PROGRESSIVE as default when no clues exist', () => {
    expect(inferReviewModeFromFields({})).toBe('FIXED_PROGRESSIVE');
  });

  it('resolves explicit reviewMode', () => {
    expect(inferReviewModeFromFields({ reviewMode: 'SPACED_INTERVAL' }))
      .toBe('SPACED_INTERVAL');
  });
});
