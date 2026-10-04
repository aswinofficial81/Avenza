export const useBaseApi = () => {
  const baseUrl = import.meta.env.VITE_API_URL || '/api/v1';

  const get = async <T>(endpoint: string, options: { params?: Record<string, unknown> } = {}): Promise<T> => {
    const url = new URL(`${baseUrl}${endpoint}`);
    Object.keys(options.params || {}).forEach(key => {
      if (options.params?.[key] !== undefined && options.params?.[key] !== null) {
        url.searchParams.append(key, String(options.params[key]));
      }
    });

    const response = await fetch(url.toString(), {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  const post = async <T>(endpoint: string, data: unknown): Promise<T> => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  const patch = async <T>(endpoint: string, data: unknown): Promise<T> => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  const del = async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'DELETE',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  };

  return {
    get,
    post,
    patch,
    delete: del,
  };
};