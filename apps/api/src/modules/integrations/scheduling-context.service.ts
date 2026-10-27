/**
 * Scheduling Context Service Boundary
 *
 * READ-ONLY EXTERNAL SCHEDULING CONTEXT.
 *
 * Invariant: Calendar events are external temporal scheduling constraints.
 * They MUST NOT:
 * - create DSA problems or attempts
 * - modify mastery
 * - create Skills
 * - complete Goals, Milestones, or Tasks
 * - generate achievement evidence
 */

import type { ExternalCalendarEventEntity, IIntegrationsRepository } from './integrations.repository';

export interface ISchedulingContextService {
  /**
   * Retrieves active external calendar events for the given user to inform
   * scheduling/planner context.
   */
  getActiveCalendarEvents(userId: string): Promise<ExternalCalendarEventEntity[]>;
}

export class SchedulingContextService implements ISchedulingContextService {
  constructor(private readonly repository: IIntegrationsRepository) {}

  async getActiveCalendarEvents(userId: string): Promise<ExternalCalendarEventEntity[]> {
    return this.repository.listCalendarEvents(userId);
  }
}
