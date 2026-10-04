import { DsaProblemsList } from '../components/DsaProblemsList';

export const DsaProblemsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">DSA Problems</h1>
      <DsaProblemsList />
    </div>
  );
};