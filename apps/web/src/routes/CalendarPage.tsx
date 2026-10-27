import React, { useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useUnifiedCalendar } from '../features/calendar/useUnifiedCalendar';
import type { CalendarViewMode } from '../features/calendar/types';
import {
  CalendarHeader,
  CalendarMonthView,
  CalendarWeekView,
  CalendarAgendaView,
  CalendarDayAgenda,
  CalendarLegend,
  GoogleCalendarBanner,
} from '../features/calendar/components';

export const CalendarPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  const {
    events,
    isLoading,
    isError,
    googleStatus,
    isGoogleConnected,
    isSyncing,
    handleSyncGoogle,
    refetchAll,
  } = useUnifiedCalendar();

  const handlePreviousPeriod = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(prev.getMonth() - 1);
      } else if (viewMode === 'week') {
        next.setDate(prev.getDate() - 7);
      } else {
        next.setMonth(prev.getMonth() - 1);
      }
      return next;
    });
  };

  const handleNextPeriod = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(prev.getMonth() + 1);
      } else if (viewMode === 'week') {
        next.setDate(prev.getDate() + 7);
      } else {
        next.setMonth(prev.getMonth() + 1);
      }
      return next;
    });
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    if (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(date));
    }
  };

  return (
    <div data-testid="calendar-page" className="space-y-6 pb-12">
      {/* Calendar Header with period navigation and view switcher */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={handlePreviousPeriod}
        onNext={handleNextPeriod}
        onToday={handleToday}
        onRefresh={refetchAll}
        isRefreshing={isSyncing}
      />

      {/* Google Calendar Sync & Status Banner */}
      <GoogleCalendarBanner
        isConnected={isGoogleConnected}
        isSyncing={isSyncing}
        onSync={handleSyncGoogle}
        statusData={googleStatus}
      />

      {/* Partial Error Notification */}
      {isError && (
        <div
          data-testid="calendar-partial-error"
          className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Some schedule sources could not be refreshed. Displaying available persisted events.
          </span>
        </div>
      )}

      {/* Main Calendar Content Area */}
      {isLoading ? (
        <div
          data-testid="calendar-loading-skeleton"
          className="rounded-lg border border-border bg-card p-12 text-center flex flex-col items-center justify-center space-y-3 shadow-sm"
        >
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-foreground">Loading schedule...</p>
          <p className="text-xs text-muted-foreground">Aggregating Google Calendar and Avenza deadlines.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'month' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                <CalendarMonthView
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  events={events}
                />
                <CalendarLegend className="hidden lg:flex" />
              </div>

              <div className="lg:col-span-4 xl:col-span-3 space-y-4">
                <CalendarDayAgenda
                  selectedDate={selectedDate}
                  events={events}
                  className="min-h-[380px]"
                />
                <CalendarLegend className="lg:hidden" />
              </div>
            </div>
          )}

          {viewMode === 'week' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                <CalendarWeekView
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  events={events}
                />
                <CalendarLegend className="hidden lg:flex" />
              </div>

              <div className="lg:col-span-4 xl:col-span-3 space-y-4">
                <CalendarDayAgenda
                  selectedDate={selectedDate}
                  events={events}
                  className="min-h-[380px]"
                />
                <CalendarLegend className="lg:hidden" />
              </div>
            </div>
          )}

          {viewMode === 'agenda' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 xl:col-span-9 space-y-4">
                <CalendarAgendaView
                  events={events}
                  onSelectDate={handleSelectDate}
                />
                <CalendarLegend className="hidden lg:flex" />
              </div>

              <div className="lg:col-span-4 xl:col-span-3 space-y-4">
                <CalendarDayAgenda
                  selectedDate={selectedDate}
                  events={events}
                  className="min-h-[380px]"
                />
                <CalendarLegend className="lg:hidden" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
