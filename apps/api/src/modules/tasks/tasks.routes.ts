import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultTasksController, TasksController } from './tasks.controller';

export interface TasksRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  tasksController?: TasksController;
}

export function createTasksRoutes(opts: TasksRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.tasksController || defaultTasksController;

  return async (fastify) => {
    // 1. Task CRUD Routes
    fastify.get(
      '/api/v1/tasks',
      { preHandler: [authHook] },
      async (request, reply) => controller.listTasks(request, reply)
    );

    fastify.post(
      '/api/v1/tasks',
      { preHandler: [authHook] },
      async (request, reply) => controller.createTask(request, reply)
    );

    fastify.get(
      '/api/v1/tasks/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.getTask(request, reply)
    );

    fastify.patch(
      '/api/v1/tasks/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.updateTask(request, reply)
    );

    fastify.delete(
      '/api/v1/tasks/:id',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteTask(request, reply)
    );

    // 2. Task Dependency Routes
    fastify.get(
      '/api/v1/tasks/:id/dependencies',
      { preHandler: [authHook] },
      async (request, reply) => controller.listDependencies(request, reply)
    );

    fastify.post(
      '/api/v1/tasks/:id/dependencies',
      { preHandler: [authHook] },
      async (request, reply) => controller.createDependency(request, reply)
    );

    fastify.delete(
      '/api/v1/tasks/:id/dependencies/:dependencyId',
      { preHandler: [authHook] },
      async (request, reply) => controller.deleteDependency(request, reply)
    );
  };
}

export const tasksRoutes = createTasksRoutes();
