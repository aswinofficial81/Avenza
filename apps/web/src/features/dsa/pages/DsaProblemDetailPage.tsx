import React from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

export const DsaProblemDetailPage: React.FC = () => {
  const { problemId } = useParams<{ problemId: string }>();

  // In a real implementation, we would use useQuery to fetch the data
  // For now, we'll simulate loading state

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">Problem Details</h1>
        <div className="flex space-x-3">
          <Link to={`/dsa/problems/${problemId}/edit`} className="btn btn-outline">
            Edit
          </Link>
          <Link to={`/dsa/problems/${problemId}/attempt`} className="btn btn-outline">
            Record Attempt
          </Link>
        </div>
      </div>

      <div className="text-center py-8">
        <div className="animate-pulse">Loading problem details...</div>
      </div>
    </div>
  );
};