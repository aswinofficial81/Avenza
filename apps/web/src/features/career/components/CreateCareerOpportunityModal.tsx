import React, { useState } from 'react';
import type {
  CareerEmploymentType,
  CareerLocationType,
  CareerOpportunitySource,
  CareerOpportunityStatus,
  CareerTargetDto,
  CreateCareerOpportunityInput,
} from '@avenza/shared';
import {
  CAREER_EMPLOYMENT_TYPES,
  CAREER_LOCATION_TYPES,
  CAREER_OPPORTUNITY_SOURCES,
} from '@avenza/shared';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea } from '../../../components/ui/Textarea';
import { Label } from '../../../components/ui/Label';
import { useCreateCareerOpportunity } from '../hooks/useCareer';
import { Plus } from 'lucide-react';

export interface CreateCareerOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: CareerTargetDto[];
  initialTargetId?: string;
  onSuccess?: () => void;
}

export const CreateCareerOpportunityModal: React.FC<CreateCareerOpportunityModalProps> = ({
  isOpen,
  onClose,
  targets,
  initialTargetId = '',
  onSuccess,
}) => {
  const [companyName, setCompanyName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [targetId, setTargetId] = useState(initialTargetId);
  const [employmentType, setEmploymentType] = useState<CareerEmploymentType | ''>('full_time');
  const [locationType, setLocationType] = useState<CareerLocationType | ''>('remote');
  const [location, setLocation] = useState('');
  const [source, setSource] = useState<CareerOpportunitySource>('linkedin');
  const [jobUrl, setJobUrl] = useState('');
  const [salaryMinStr, setSalaryMinStr] = useState('');
  const [salaryMaxStr, setSalaryMaxStr] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createOppMutation = useCreateCareerOpportunity();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!companyName.trim()) {
      setErrorMsg('Company name is required.');
      return;
    }
    if (!roleTitle.trim()) {
      setErrorMsg('Role title is required.');
      return;
    }

    const minSalary = salaryMinStr ? parseFloat(salaryMinStr) : undefined;
    const maxSalary = salaryMaxStr ? parseFloat(salaryMaxStr) : undefined;

    if (minSalary != null && maxSalary != null && maxSalary < minSalary) {
      setErrorMsg('Maximum salary cannot be less than minimum salary.');
      return;
    }

    if (jobUrl.trim()) {
      try {
        const parsed = new URL(jobUrl.trim());
        if (!parsed.protocol.startsWith('http')) {
          setErrorMsg('Job URL must use http:// or https://');
          return;
        }
      } catch {
        setErrorMsg('Please enter a valid job URL.');
        return;
      }
    }

    const payload: CreateCareerOpportunityInput = {
      company_name: companyName.trim(),
      role_title: roleTitle.trim(),
      target_id: targetId || null,
      employment_type: employmentType ? employmentType : null,
      location_type: locationType ? locationType : null,
      location: location.trim() || null,
      source: source || 'other',
      job_url: jobUrl.trim() || null,
      salary_min: minSalary != null ? minSalary : null,
      salary_max: maxSalary != null ? maxSalary : null,
      salary_currency: currency.trim() || 'USD',
      deadline: deadline ? new Date(deadline).toISOString() : null,
      description: description.trim() || null,
      status: 'active' as CareerOpportunityStatus,
    };

    try {
      await createOppMutation.mutateAsync(payload);
      resetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create opportunity.');
    }
  };

  const resetForm = () => {
    setCompanyName('');
    setRoleTitle('');
    setTargetId(initialTargetId);
    setEmploymentType('full_time');
    setLocationType('remote');
    setLocation('');
    setSource('linkedin');
    setJobUrl('');
    setSalaryMinStr('');
    setSalaryMaxStr('');
    setCurrency('USD');
    setDeadline('');
    setDescription('');
    setErrorMsg(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Job Opportunity"
      description="Record a verified job opening, internship, or lead."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMsg && (
          <div className="p-3 text-xs rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="opp-company-input" required>
              Company Name
            </Label>
            <Input
              id="opp-company-input"
              placeholder="e.g. Stripe, Linear, Vercel"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="opp-role-input" required>
              Role Title
            </Label>
            <Input
              id="opp-role-input"
              placeholder="e.g. Infrastructure Engineer, Core Platform"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="opp-target-select">Career Target Profile</Label>
            <Select
              id="opp-target-select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs"
            >
              <option value="">No target association</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.target_role})
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-source-select">Source Channel</Label>
            <Select
              id="opp-source-select"
              value={source}
              onChange={(e) => setSource(e.target.value as CareerOpportunitySource)}
              disabled={createOppMutation.isPending}
              className="text-xs capitalize"
            >
              {CAREER_OPPORTUNITY_SOURCES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-employment-type-select">Employment Type</Label>
            <Select
              id="opp-employment-type-select"
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value as CareerEmploymentType)}
              disabled={createOppMutation.isPending}
              className="text-xs capitalize"
            >
              <option value="">Any Employment Type</option>
              {CAREER_EMPLOYMENT_TYPES.map((type) => (
                <option key={type} value={type} className="capitalize">
                  {type.replace('_', ' ')}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-location-type-select">Workplace Model</Label>
            <Select
              id="opp-location-type-select"
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as CareerLocationType)}
              disabled={createOppMutation.isPending}
              className="text-xs capitalize"
            >
              <option value="">Unspecified</option>
              {CAREER_LOCATION_TYPES.map((l) => (
                <option key={l} value={l} className="capitalize">
                  {l}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-location-input">City / Region</Label>
            <Input
              id="opp-location-input"
              placeholder="e.g. Seattle, WA or Remote US"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="opp-job-url-input">Listing / Posting URL</Label>
            <Input
              id="opp-job-url-input"
              type="url"
              placeholder="https://jobs.company.com/listing/..."
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-salary-min-input">Salary Min</Label>
            <Input
              id="opp-salary-min-input"
              type="number"
              placeholder="e.g. 130000"
              value={salaryMinStr}
              onChange={(e) => setSalaryMinStr(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-salary-max-input">Salary Max</Label>
            <Input
              id="opp-salary-max-input"
              type="number"
              placeholder="e.g. 165000"
              value={salaryMaxStr}
              onChange={(e) => setSalaryMaxStr(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-currency-input">Currency</Label>
            <Input
              id="opp-currency-input"
              placeholder="USD"
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              disabled={createOppMutation.isPending}
              className="text-xs font-mono uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="opp-deadline-input">Application Deadline</Label>
            <Input
              id="opp-deadline-input"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              disabled={createOppMutation.isPending}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="opp-description-input">Job Description & Highlights</Label>
            <Textarea
              id="opp-description-input"
              placeholder="Key technical qualifications, team mission, notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createOppMutation.isPending}
              rows={2}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createOppMutation.isPending}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={createOppMutation.isPending}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            id="submit-create-opp-btn"
          >
            Save Opportunity
          </Button>
        </div>
      </form>
    </Modal>
  );
};
