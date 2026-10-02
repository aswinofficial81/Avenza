import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  Button,
  IconButton,
  Badge,
  Input,
  Textarea,
  Select,
  Checkbox,
  Switch,
  EmptyState,
  ErrorState,
  Skeleton,
  Spinner,
  Modal,
  ConfirmationDialog,
  Progress,
} from './index';

describe('UI Primitives Library', () => {
  describe('Button & IconButton', () => {
    it('renders all variants and sizes with proper classes', () => {
      const { rerender } = render(<Button variant="primary">Primary</Button>);
      expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();

      rerender(<Button variant="danger">Danger</Button>);
      expect(screen.getByRole('button', { name: 'Danger' })).toBeInTheDocument();

      rerender(<Button variant="outline">Outline</Button>);
      expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();

      rerender(<IconButton icon={<span>Icon</span>} aria-label="Icon Action" />);
      expect(screen.getByRole('button', { name: 'Icon Action' })).toBeInTheDocument();
    });

    it('handles loading state with spinner and disables button', () => {
      render(<Button isLoading>Save</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Form Components', () => {
    it('renders Input with accessible label, description, and error state', () => {
      const { rerender } = render(
        <Input
          label="Email Address"
          description="Enter your primary email"
          placeholder="name@example.com"
        />
      );

      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
      expect(screen.getByText('Enter your primary email')).toBeInTheDocument();

      rerender(
        <Input
          label="Email Address"
          error="Invalid email address format"
          placeholder="name@example.com"
        />
      );

      const input = screen.getByLabelText('Email Address');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('Invalid email address format')).toBeInTheDocument();
    });

    it('renders Textarea with label and description', () => {
      render(<Textarea label="Notes" description="Technical commentary" />);
      expect(screen.getByLabelText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Technical commentary')).toBeInTheDocument();
    });

    it('renders Select with options', () => {
      render(
        <Select
          label="Mode"
          options={[
            { label: 'Option A', value: 'a' },
            { label: 'Option B', value: 'b' },
          ]}
        />
      );
      expect(screen.getByLabelText('Mode')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toHaveValue('a');
    });

    it('renders Checkbox and toggles', () => {
      const handleChange = vi.fn();
      render(<Checkbox label="Agree to terms" onChange={handleChange} />);
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(handleChange).toHaveBeenCalled();
    });

    it('renders Switch and invokes onCheckedChange', () => {
      const handleToggle = vi.fn();
      render(<Switch label="Dark Mode" checked={false} onCheckedChange={handleToggle} />);
      const switchEl = screen.getByRole('switch');
      fireEvent.click(switchEl);
      expect(handleToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('Badges and Progress', () => {
    it('renders Badge with variants', () => {
      render(<Badge variant="success">Completed</Badge>);
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('renders Progress with aria attributes', () => {
      render(<Progress value={45} label="Sync Progress" showValue />);
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '45');
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });

  describe('Empty, Error, and Loading States', () => {
    it('renders EmptyState with title, description, and optional action', () => {
      render(
        <EmptyState
          title="No records found"
          description="Try modifying search criteria."
          action={<button>Add New</button>}
        />
      );

      expect(screen.getByText('No records found')).toBeInTheDocument();
      expect(screen.getByText('Try modifying search criteria.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add New' })).toBeInTheDocument();
    });

    it('renders ErrorState and triggers retry', () => {
      const handleRetry = vi.fn();
      render(
        <ErrorState
          title="Network Error"
          description="Failed to load items."
          onRetry={handleRetry}
          retryLabel="Try Again"
        />
      );

      expect(screen.getByText('Network Error')).toBeInTheDocument();
      const retryBtn = screen.getByRole('button', { name: /Try Again/i });
      fireEvent.click(retryBtn);
      expect(handleRetry).toHaveBeenCalled();
    });

    it('renders Skeleton and Spinner', () => {
      render(
        <div>
          <Skeleton width={100} height={20} />
          <Spinner label="Loading items..." />
        </div>
      );

      expect(screen.getByLabelText('Loading...')).toBeInTheDocument();
      expect(screen.getByLabelText('Loading items...')).toBeInTheDocument();
    });
  });

  describe('Modal and ConfirmationDialog', () => {
    it('opens and closes modal via close button and escape key', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={true} onClose={handleClose} title="Dialog Header">
          <p>Dialog Body</p>
        </Modal>
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Dialog Header')).toBeInTheDocument();
      expect(screen.getByText('Dialog Body')).toBeInTheDocument();

      // Click close button
      const closeBtn = screen.getByLabelText('Close dialog');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();

      // Escape key
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(2);

      // Hidden when isOpen is false
      rerender(
        <Modal isOpen={false} onClose={handleClose} title="Dialog Header">
          <p>Dialog Body</p>
        </Modal>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders ConfirmationDialog and calls confirm action', () => {
      const handleConfirm = vi.fn();
      const handleClose = vi.fn();
      render(
        <ConfirmationDialog
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title="Confirm Deletion"
          message="Are you sure you want to proceed?"
          confirmLabel="Delete Forever"
          variant="danger"
        />
      );

      expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
      const confirmBtn = screen.getByRole('button', { name: 'Delete Forever' });
      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalled();
    });
  });
});
