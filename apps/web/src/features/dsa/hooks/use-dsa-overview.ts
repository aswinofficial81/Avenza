import { useQuery } from '@tanstack/react-query';
import { useDsaApi } from '../../../lib/api/dsa';

export const useDsaOverview = () => {
  const dsaApi = useDsaApi();

  return useQuery({
    queryKey: ['dsa-overview'],
    queryFn: () => dsaApi.getOverview(),
  });
};