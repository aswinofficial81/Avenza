import type { FastifyPluginAsync } from 'fastify';
import { requireAuth as defaultRequireAuth } from '../../auth/auth.middleware';
import { defaultProfileController, ProfileController } from './profile.controller';

export interface ProfileRoutesOptions {
  requireAuthMiddleware?: typeof defaultRequireAuth;
  profileController?: ProfileController;
}

export function createProfileRoutes(opts: ProfileRoutesOptions = {}): FastifyPluginAsync {
  const authHook = opts.requireAuthMiddleware || defaultRequireAuth;
  const controller = opts.profileController || defaultProfileController;

  return async (fastify) => {
    fastify.get(
      '/api/v1/auth/me',
      {
        preHandler: [authHook],
      },
      async (request, reply) => {
        return controller.getMe(request, reply);
      }
    );

    fastify.delete(
      '/api/v1/auth/me',
      {
        preHandler: [authHook],
      },
      async (request, reply) => {
        return controller.deleteMe(request, reply);
      }
    );

    fastify.get(
      '/api/v1/account/export',
      {
        preHandler: [authHook],
      },
      async (request, reply) => {
        return controller.exportAccountData(request, reply);
      }
    );

    fastify.get(
      '/api/v1/auth/export',
      {
        preHandler: [authHook],
      },
      async (request, reply) => {
        return controller.exportAccountData(request, reply);
      }
    );
  };
}

export const profileRoutes = createProfileRoutes();
