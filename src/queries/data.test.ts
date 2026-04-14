import { getPluginPageBlockDataQuery, getPluginPageData } from '~/queries/data';

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

  it('prefers card meta fields over session-level legacy copies', async () => {
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
                      string: 'meta',
                      children: [
                        { string: 'lineByLineReview:: Y' },
                        { string: 'lineByLineProgress:: {"child-1":{"interval":6}}' },
                        { string: 'nextDueDate:: [[April 20th, 2026]]' },
                      ],
                    },
                    {
                      string: '[[April 14th, 2026]] 🟢',
                      order: 0,
                      children: [
                        { string: 'reviewMode:: SPACED_INTERVAL' },
                        { string: 'lineByLineReview:: N' },
                        { string: 'lineByLineProgress:: {"legacy":true}' },
                        { string: 'nextDueDate:: [[April 15th, 2026]]' },
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
      lineByLineReview: 'Y',
      lineByLineProgress: '{"child-1":{"interval":6}}',
    });
    const cardData = result['card-1'] as any;
    expect(cardData.nextDueDate).toEqual(new Date('2026-04-20T00:00:00.000Z'));
  });
});
