import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useBaseApi } from './base';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('../api-client', () => ({
  useApiClient: () => ({
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  }),
}));

describe('useBaseApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefixes relative endpoint with /api/v1 and unwraps enveloped response', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: { total_problems: 10, solved_problems: 5 },
    });

    const baseApi = useBaseApi();
    const result = await baseApi.get<{ total_problems: number; solved_problems: number }>('/dsa/overview');

    expect(mockGet).toHaveBeenCalledWith('/api/v1/dsa/overview');
    expect(result).toEqual({ total_problems: 10, solved_problems: 5 });
  });

  it('correctly appends query parameters with URLSearchParams', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [{ id: 'prob-1', title: 'Two Sum' }],
    });

    const baseApi = useBaseApi();
    const result = await baseApi.get<Array<{ id: string; title: string }>>('/dsa/problems', {
      params: { difficulty: 'easy', search: 'sum' },
    });

    expect(mockGet).toHaveBeenCalledWith('/api/v1/dsa/problems?difficulty=easy&search=sum');
    expect(result).toEqual([{ id: 'prob-1', title: 'Two Sum' }]);
  });

  it('does not duplicate /api/v1 if already present in endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: { id: 'prob-1' },
    });

    const baseApi = useBaseApi();
    await baseApi.get('/api/v1/dsa/problems/prob-1');

    expect(mockGet).toHaveBeenCalledWith('/api/v1/dsa/problems/prob-1');
  });

  it('delegates post, patch, and delete to useApiClient and unwraps', async () => {
    mockPost.mockResolvedValueOnce({ success: true, data: { id: 'created-1' } });
    mockPatch.mockResolvedValueOnce({ success: true, data: { id: 'updated-1' } });
    mockDelete.mockResolvedValueOnce({ success: true, data: { deleted: true } });

    const baseApi = useBaseApi();

    const postRes = await baseApi.post('/dsa/problems', { title: 'New Problem' });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/dsa/problems', { title: 'New Problem' });
    expect(postRes).toEqual({ id: 'created-1' });

    const patchRes = await baseApi.patch('/dsa/problems/prob-1', { title: 'Updated Title' });
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/dsa/problems/prob-1', { title: 'Updated Title' });
    expect(patchRes).toEqual({ id: 'updated-1' });

    const delRes = await baseApi.delete('/dsa/problems/prob-1');
    expect(mockDelete).toHaveBeenCalledWith('/api/v1/dsa/problems/prob-1');
    expect(delRes).toEqual({ deleted: true });
  });
});
