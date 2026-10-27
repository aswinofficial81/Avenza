import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { WeeklyReviewSummary } from '@avenza/shared';
import { WeeklyReviewPage } from './WeeklyReviewPage';

const {
    useWeeklyReviewMock,
    useSaveWeeklyReviewMock,
    saveMutateMock,
} = vi.hoisted(() => ({
    useWeeklyReviewMock: vi.fn(),
    useSaveWeeklyReviewMock: vi.fn(),
    saveMutateMock: vi.fn(),
}));

vi.mock('../features/weekly-review/useWeeklyReview', () => ({
    useWeeklyReview: useWeeklyReviewMock,
    useSaveWeeklyReview: useSaveWeeklyReviewMock,
}));

const summary: WeeklyReviewSummary = {
    weekStart: '2026-10-26',
    weekEnd: '2026-11-01',
    timezone: 'Asia/Kolkata',
    metrics: {
        completedTasks: 3,
        focusMinutes: 125,
        dsaAttempts: 6,
        goalsCompleted: 1,
    },
    review: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        weekStart: '2026-10-26',
        weekEnd: '2026-11-01',
        timezone: 'Asia/Kolkata',
        wentWell: 'Finished my planned work',
        challenges: 'Some distractions',
        nextWeekPriority: 'Practise DSA daily',
        createdAt: '2026-10-27T10:00:00.000Z',
        updatedAt: '2026-10-27T10:00:00.000Z',
    },
};

describe('WeeklyReviewPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        useWeeklyReviewMock.mockReturnValue({
            data: summary,
            isLoading: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
            isFetching: false,
        });

        useSaveWeeklyReviewMock.mockReturnValue({
            mutate: saveMutateMock,
            isPending: false,
            isError: false,
            isSuccess: false,
            error: null,
        });
    });

    it('renders weekly metrics and the previously saved reflection', () => {
        render(<WeeklyReviewPage />);

        expect(
            screen.getByRole('heading', { name: 'Weekly Review' }),
        ).toBeTruthy();

        expect(screen.getByText('Tasks completed')).toBeTruthy();
        expect(screen.getByText('Focus time')).toBeTruthy();
        expect(screen.getByText('DSA attempts')).toBeTruthy();
        expect(screen.getByText('Goals completed')).toBeTruthy();

        expect(
            screen.getByLabelText('What went well?'),
        ).toHaveProperty('value', 'Finished my planned work');

        expect(
            screen.getByLabelText('What challenged you?'),
        ).toHaveProperty('value', 'Some distractions');

        expect(
            screen.getByLabelText("Next week's priority"),
        ).toHaveProperty('value', 'Practise DSA daily');
    });

    it('submits the edited reflection using the current week and timezone', () => {
        render(<WeeklyReviewPage />);

        fireEvent.change(screen.getByLabelText('What went well?'), {
            target: { value: 'Completed my DSA practice' },
        });

        fireEvent.click(screen.getByTestId('weekly-review-save'));

        expect(saveMutateMock).toHaveBeenCalledWith(
            expect.objectContaining({
                weekStart: expect.any(String),
                timezone: expect.any(String),
                wentWell: 'Completed my DSA practice',
                challenges: 'Some distractions',
                nextWeekPriority: 'Practise DSA daily',
            }),
        );
    });
});