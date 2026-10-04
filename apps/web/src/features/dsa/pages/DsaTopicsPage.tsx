import React from 'react';
import { Link } from 'react-router-dom';

export const DsaTopicsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold">DSA Topics</h1>
        <Link to="/dsa/topics/create" className="btn btn-primary">
          Add Topic
        </Link>
      </div>

      <div className="text-center py-8">
        <div className="animate-pulse">Loading topics...</div>
      </div>
    </div>
  );
};