import { useQuery } from '@tanstack/react-query';
import { useDsaApi } from '../../../lib/api/dsa';

export const useDsaProblemDetail = (problemId: string | undefined) => {
  const dsaApi = useDsaApi();

  return useQuery({
    queryKey: ['dsa-problem-detail', problemId],
    queryFn: async () => {
      if (!problemId) {
        throw new Error('Problem ID is required');
      }
      return dsaApi.getProblemDetail(problemId);
    },
    enabled: Boolean(problemId),
  });
};
