import { useQuery } from '@tanstack/react-query';
import { useDsaApi } from '../../../lib/api/dsa';

export const useDsaProblems = () => {
  const dsaApi = useDsaApi();

  return useQuery({
    queryKey: ['dsa-problems'],
    queryFn: () => dsaApi.listProblems(),
  });
};