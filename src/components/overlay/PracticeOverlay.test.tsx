import { act, render, screen } from '@testing-library/react';

import * as testUtils from '~/utils/testUtils';
import * as dateUtils from '~/utils/date';

import App from '~/app';
import { shouldReinsertReadCard } from './PracticeOverlay';
import { ReviewModes } from '~/models/session';
import * as saveQueries from '~/queries/save';

/** Check that a Date value is within toleranceMs of the expected Date (default 1s) */
const expectDateCloseTo = (actual: Date, expected: Date, toleranceMs = 1000) => {
  expect(actual).toBeInstanceOf(Date);
  expect(Math.abs(actual.getTime() - expected.getTime())).toBeLessThanOrEqual(toleranceMs);
};

describe('PracticeOverlay', () => {
  it("renders done state when there's no practice data", async () => {
    new testUtils.MockDataBuilder().mockQueryResults();
    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      testUtils.actions.launchModal();
    });

    const practiceOverlayDoneState = document.querySelector<HTMLDivElement>(
      '[data-testid="practice-overlay-done-state"]'
    );
    expect(practiceOverlayDoneState).toBeInTheDocument();
  });

  it('Renders correctly when 1 new card', async () => {
    const mockBuilder = new testUtils.MockDataBuilder();

    mockBuilder.withCard({ uid: 'id_new_1' });
    mockBuilder.mockQueryResults();

    await act(async () => {
      render(<App />);
    });

    // Renders new tag count in sidepanel
    const newTag = screen.queryByTestId('new-tag');
    expect(newTag).toHaveTextContent('1');

    await act(async () => {
      testUtils.actions.launchModal();
    });

    // Renders "New" status badge
    const statusBadge = screen.queryByTestId('status-badge');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveTextContent('New');

    // Renders display count 1/1
    const displayCountCurrent = screen.queryByTestId('display-count-current');
    expect(displayCountCurrent).toBeInTheDocument();
    expect(displayCountCurrent).toHaveTextContent('1');

    const displayCountTotal = screen.queryByTestId('display-count-total');
    expect(displayCountTotal).toBeInTheDocument();
    expect(displayCountTotal).toHaveTextContent('1');
  });

  it("Renders correctly when 1 new card, even when data page doesn't exist yet", async () => {
    const mockBuilder = new testUtils.MockDataBuilder();

    mockBuilder.withCard({ uid: 'id_new_1' });
    mockBuilder.mockQueryResultsWithoutDataPage();

    await act(async () => {
      render(<App />);
    });

    // Renders new tag count in sidepanel
    const newTag = screen.queryByTestId('new-tag');
    expect(newTag).toHaveTextContent('1');

    await act(async () => {
      testUtils.actions.launchModal();
    });

    // Renders "New" status badge
    const statusBadge = screen.queryByTestId('status-badge');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveTextContent('New');

    // Renders display count 1/1
    const displayCountCurrent = screen.queryByTestId('display-count-current');
    expect(displayCountCurrent).toBeInTheDocument();
    expect(displayCountCurrent).toHaveTextContent('1');

    const displayCountTotal = screen.queryByTestId('display-count-total');
    expect(displayCountTotal).toBeInTheDocument();
    expect(displayCountTotal).toHaveTextContent('1');
  });

  it('Grading works correctly when switching review modes', async () => {
    const mockBuilder = new testUtils.MockDataBuilder();

    jest.spyOn(saveQueries, 'updateCardType').mockResolvedValue(undefined);

    const dueCard1 = 'id_due_1';
    mockBuilder.withCard({ uid: dueCard1 }).withSession(dueCard1, {
      dateCreated: dateUtils.subtractDays(new Date(), 1),
      nextDueDate: new Date(),
    });

    const newCard1 = 'id_new_1';
    mockBuilder.withCard({ uid: newCard1 });

    mockBuilder.mockQueryResults();
    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      testUtils.actions.launchModal();
    });

    const showAnswerButton = screen.queryByText('Show Answer');
    if (showAnswerButton) {
      await act(async () => {
        await testUtils.actions.clickControlButton('Show Answer');
      });
    }

    const result = await testUtils.grade('Good', mockBuilder);
    expect(result.updatedRecord).toMatchObject({
      reviewMode: ReviewModes.SpacedInterval,
      dataPageTitle: testUtils.dataPageTitle,
      refUid: 'id_due_1',
    });
    expectDateCloseTo(result.updatedRecord.dateCreated, new Date());

    const statusBadge = screen.queryByTestId('status-badge');
    expect(statusBadge).toHaveTextContent('New');
  });

  it('Grading works correctly when switching review modes starting with fixed', async () => {
    const mockBuilder = new testUtils.MockDataBuilder();

    jest.spyOn(saveQueries, 'updateCardType').mockResolvedValue(undefined);

    const dueCard1 = 'id_due_1';
    mockBuilder.withCard({ uid: dueCard1 }).withSession(dueCard1, {
      reviewMode: ReviewModes.FixedProgressive,
      grade: 1,
      dateCreated: dateUtils.subtractDays(new Date(), 1),
      nextDueDate: new Date(),
    });

    mockBuilder.mockQueryResults();
    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      testUtils.actions.launchModal();
    });

    const result = await testUtils.grade('Next', mockBuilder);
    expect(result.updatedRecord).toMatchObject({
      reviewMode: ReviewModes.FixedProgressive,
      dataPageTitle: testUtils.dataPageTitle,
      refUid: 'id_due_1',
    });
  });

  it('persists SPACED_INTERVAL when grading right after switching from fixed mode', async () => {
    const mockBuilder = new testUtils.MockDataBuilder();
    jest.spyOn(saveQueries, 'updateCardType').mockResolvedValue(undefined);

    const dueCard1 = 'id_due_1';
    mockBuilder.withCard({ uid: dueCard1 }).withSession(dueCard1, {
      reviewMode: ReviewModes.FixedProgressive,
      grade: 1,
      dateCreated: dateUtils.subtractDays(new Date(), 1),
      nextDueDate: new Date(),
    });

    mockBuilder.mockQueryResults();
    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      testUtils.actions.launchModal();
    });

    await act(async () => {
      await testUtils.actions.clickSwitchReviewModeButton('Spaced Interval');
    });

    const result = await testUtils.grade('Good', mockBuilder);
    expect(result.updatedRecord).toMatchObject({
      reviewMode: ReviewModes.SpacedInterval,
      dataPageTitle: testUtils.dataPageTitle,
      refUid: 'id_due_1',
    });
  });

  it('Fixed Interval cards are expanded immediately without Show Answer', async () => {
    const mockBuilder = new testUtils.MockDataBuilder();
    const dueCard1 = 'id_due_fixed_1';

    mockBuilder.withCard({ uid: dueCard1 }).withSession(dueCard1, {
      reviewMode: ReviewModes.FixedProgressive,
      grade: 1,
      dateCreated: dateUtils.subtractDays(new Date(), 1),
      nextDueDate: new Date(),
    });

    mockBuilder.mockQueryResults();
    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      testUtils.actions.launchModal();
    });

    expect(screen.queryByText('Show Answer')).not.toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('Incremental Read (FIXED_PROGRESSIVE_LBL) shows line-by-line reading UI', async () => {
    const mockBuilder = new testUtils.MockDataBuilder();
    const dueCard1 = 'id_due_fixed_lbl';

    mockBuilder.withCard({ uid: dueCard1 }).withSession(dueCard1, {
      reviewMode: ReviewModes.FixedProgressiveLBL,
      lineByLineProgress: JSON.stringify({}),
      grade: 1,
      dateCreated: dateUtils.subtractDays(new Date(), 1),
      nextDueDate: new Date(),
    });

    mockBuilder.mockQueryResults();
    await act(async () => {
      render(<App />);
    });

    await act(async () => {
      testUtils.actions.launchModal();
    });

    expect(screen.queryByText('Show Answer')).not.toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('Incremental Read reinsertion stops on the last line', () => {
    expect(
      shouldReinsertReadCard({
        currentChildIndex: 0,
        totalChildren: 1,
        readReinsertOffset: 3,
      })
    ).toBe(false);

    expect(
      shouldReinsertReadCard({
        currentChildIndex: 1,
        totalChildren: 3,
        readReinsertOffset: 3,
      })
    ).toBe(true);

    expect(
      shouldReinsertReadCard({
        currentChildIndex: 2,
        totalChildren: 3,
        readReinsertOffset: 3,
      })
    ).toBe(false);

    expect(
      shouldReinsertReadCard({
        currentChildIndex: 1,
        totalChildren: 3,
        readReinsertOffset: 0,
      })
    ).toBe(false);
  });
});
