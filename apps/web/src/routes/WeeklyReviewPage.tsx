import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarDays,
    CheckCircle2,
    Clock3,
    Code2,
    Flag,
    RefreshCw,
    Target,
} from 'lucide-react';
import type { WeeklyReviewSaveInput } from '@avenza/shared';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';
import {
    useSaveWeeklyReview,
    useWeeklyReview,
} from '../features/weekly-review/useWeeklyReview';

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function getCurrentWeekStart(): string {
    const today = new Date();
    const monday = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
    );

    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    return formatLocalDate(monday);
}

function addDays(dateString: string, days: number): string {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year!, month! - 1, day!);
    date.setDate(date.getDate() + days);

    return formatLocalDate(date);
}

function formatWeekRange(start: string, end: string): string {
    const [startYear, startMonth, startDay] = start.split('-').map(Number);
    const [endYear, endMonth, endDay] = end.split('-').map(Number);
    const startDate = new Date(startYear!, startMonth! - 1, startDay!);
    const endDate = new Date(endYear!, endMonth! - 1, endDay!);

    const startLabel = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
    }).format(startDate);

    const endLabel = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(endDate);

    return `${startLabel} – ${endLabel}`;
}

interface ReflectionFieldProps {
    id: string;
    label: string;
    description: string;
    value: string;
    maxLength: number;
    placeholder: string;
    onChange: (value: string) => void;
}

const ReflectionField: React.FC<ReflectionFieldProps> = ({
    id,
    label,
    description,
    value,
    maxLength,
    placeholder,
    onChange,
}) => (
    <div className="space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <label
                htmlFor={id}
                className="text-sm font-semibold text-foreground"
            >
                {label}
            </label>
            <span className="text-xs text-muted-foreground">
                {value.length}/{maxLength}
            </span>
        </div>

        <p className="text-xs text-muted-foreground">{description}</p>

        <textarea
            id={id}
            value={value}
            maxLength={maxLength}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full resize-y rounded-xl border border-border-subtle bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
    </div>
);

export const WeeklyReviewPage: React.FC = () => {
    const timezone = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        } catch {
            return 'UTC';
        }
    }, []);

    const weekStart = useMemo(() => getCurrentWeekStart(), []);
    const calculatedWeekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

    const { data, isLoading, isError, error, refetch, isFetching } =
        useWeeklyReview(weekStart, timezone);

    const saveReview = useSaveWeeklyReview();

    const [wentWell, setWentWell] = useState('');
    const [challenges, setChallenges] = useState('');
    const [nextWeekPriority, setNextWeekPriority] = useState('');

    const savedReview = data?.review;

    useEffect(() => {
        setWentWell(savedReview?.wentWell ?? '');
        setChallenges(savedReview?.challenges ?? '');
        setNextWeekPriority(savedReview?.nextWeekPriority ?? '');
    }, [
        savedReview?.id,
        savedReview?.updatedAt,
        savedReview?.wentWell,
        savedReview?.challenges,
        savedReview?.nextWeekPriority,
    ]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const payload: WeeklyReviewSaveInput = {
            weekStart,
            timezone,
            wentWell,
            challenges,
            nextWeekPriority,
        };

        saveReview.mutate(payload);
    };

    const metrics = data?.metrics;

    const focusHours = Math.floor((metrics?.focusMinutes ?? 0) / 60);
    const remainingFocusMinutes = Math.round((metrics?.focusMinutes ?? 0) % 60);

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-5 w-5 text-indigo-500" />
                        <h1 className="text-xl font-bold tracking-tight text-foreground">
                            Weekly Review
                        </h1>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Reflect on your progress, capture lessons, and set your next priority.
                    </p>

                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>
                            {formatWeekRange(weekStart, calculatedWeekEnd)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{data?.timezone ?? timezone}</span>
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refetch()}
                    disabled={isFetching}
                    data-testid="weekly-review-refresh"
                >
                    <RefreshCw
                        className={`mr-2 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`}
                    />
                    Refresh
                </Button>
            </div>

            {isLoading ? (
                <div
                    className="space-y-6"
                    data-testid="weekly-review-loading"
                    aria-label="Loading weekly review"
                >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Card key={index}>
                                <CardContent className="space-y-3 p-5">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-8 w-20" />
                                    <Skeleton className="h-3 w-36" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <Card>
                        <CardContent className="space-y-4 p-6">
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-28 w-full" />
                            <Skeleton className="h-28 w-full" />
                        </CardContent>
                    </Card>
                </div>
            ) : isError ? (
                <div className="py-8" data-testid="weekly-review-error">
                    <ErrorState
                        title="Failed to Load Weekly Review"
                        description={
                            error instanceof Error
                                ? error.message
                                : 'An unexpected error occurred while fetching your weekly review.'
                        }
                        onRetry={() => void refetch()}
                    />
                </div>
            ) : data ? (
                <div className="space-y-6" data-testid="weekly-review-page">
                    <section aria-labelledby="weekly-review-metrics-heading" className="space-y-3">
                        <div>
                            <h2
                                id="weekly-review-metrics-heading"
                                className="text-sm font-semibold text-foreground"
                            >
                                Your week in numbers
                            </h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Activity recorded in Avenza during this week.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Card>
                                <CardContent className="flex items-start gap-3 p-5">
                                    <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Tasks completed
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-foreground">
                                            {metrics?.completedTasks ?? 0}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="flex items-start gap-3 p-5">
                                    <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-500">
                                        <Clock3 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Focus time
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-foreground">
                                            {focusHours > 0 ? `${focusHours}h ` : ''}
                                            {remainingFocusMinutes}m
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="flex items-start gap-3 p-5">
                                    <div className="rounded-lg bg-violet-500/10 p-2 text-violet-500">
                                        <Code2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            DSA attempts
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-foreground">
                                            {metrics?.dsaAttempts ?? 0}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="flex items-start gap-3 p-5">
                                    <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                                        <Target className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Goals completed
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-foreground">
                                            {metrics?.goalsCompleted ?? 0}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </section>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Card>
                            <CardContent className="space-y-6 p-5 sm:p-6">
                                <div>
                                    <h2 className="text-base font-semibold text-foreground">
                                        Reflect on your week
                                    </h2>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        A useful review is honest, specific, and focused on what you can improve.
                                    </p>
                                </div>

                                <ReflectionField
                                    id="weekly-review-went-well"
                                    label="What went well?"
                                    description="Record wins, completed work, habits, or progress you're proud of."
                                    value={wentWell}
                                    maxLength={3000}
                                    placeholder="What progress did you make this week?"
                                    onChange={setWentWell}
                                />

                                <ReflectionField
                                    id="weekly-review-challenges"
                                    label="What challenged you?"
                                    description="Identify blockers, distractions, missed commitments, or lessons learned."
                                    value={challenges}
                                    maxLength={3000}
                                    placeholder="What slowed you down, and what did you learn?"
                                    onChange={setChallenges}
                                />

                                <ReflectionField
                                    id="weekly-review-next-priority"
                                    label="Next week's priority"
                                    description="Choose one concrete outcome to focus on next week."
                                    value={nextWeekPriority}
                                    maxLength={1000}
                                    placeholder="By the end of next week, I want to..."
                                    onChange={setNextWeekPriority}
                                />

                                {saveReview.isError && (
                                    <p
                                        className="text-sm text-destructive"
                                        role="alert"
                                        data-testid="weekly-review-save-error"
                                    >
                                        {saveReview.error instanceof Error
                                            ? saveReview.error.message
                                            : 'Unable to save the weekly review. Please try again.'}
                                    </p>
                                )}

                                {saveReview.isSuccess && (
                                    <p
                                        className="flex items-center gap-2 text-sm text-emerald-600"
                                        role="status"
                                        data-testid="weekly-review-save-success"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Weekly review saved successfully.
                                    </p>
                                )}

                                <div className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-muted-foreground">
                                        Your reflection is saved to your Avenza account.
                                    </p>

                                    <Button
                                        type="submit"
                                        disabled={saveReview.isPending}
                                        data-testid="weekly-review-save"
                                    >
                                        {saveReview.isPending ? (
                                            <>
                                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                                Saving…
                                            </>
                                        ) : (
                                            <>
                                                <Flag className="mr-2 h-4 w-4" />
                                                Save weekly review
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </form>
                </div>
            ) : null}
        </div>
    );
};