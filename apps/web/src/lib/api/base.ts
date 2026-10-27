import { useApiClient } from '../api-client';

export const useBaseApi = () => {
  const api = useApiClient();

  const buildPath = (endpoint: string, params?: Record<string, unknown>): string => {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullPath = normalizedEndpoint.startsWith('/api/v1')
      ? normalizedEndpoint
      : `/api/v1${normalizedEndpoint}`;

    if (!params) {
      return fullPath;
    }

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });

    const queryStr = searchParams.toString();
    return queryStr ? `${fullPath}?${queryStr}` : fullPath;
  };

  const unwrap = <T>(res: unknown): T => {
    if (res && typeof res === 'object' && 'data' in res && (res as { success?: boolean }).success === true) {
      return (res as { data: T }).data;
    }
    return res as T;
  };

  const get = async <T>(endpoint: string, options: { params?: Record<string, unknown> } = {}): Promise<T> => {
    const path = buildPath(endpoint, options.params);
    const res = await api.get<unknown>(path);
    return unwrap<T>(res);
  };

  const post = async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const path = buildPath(endpoint);
    const res = await api.post<unknown>(path, data);
    return unwrap<T>(res);
  };

  const patch = async <T>(endpoint: string, data?: unknown): Promise<T> => {
    const path = buildPath(endpoint);
    const res = await api.patch<unknown>(path, data);
    return unwrap<T>(res);
  };

  const del = async <T>(endpoint: string): Promise<T> => {
    const path = buildPath(endpoint);
    const res = await api.delete<unknown>(path);
    return unwrap<T>(res);
  };

  return {
    get,
    post,
    patch,
    delete: del,
  };
};