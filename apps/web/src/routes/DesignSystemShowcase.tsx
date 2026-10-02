import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Badge,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Stat,
  Progress,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Pagination,
  Alert,
  Spinner,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
  Modal,
  ConfirmationDialog,
  Tooltip,
  Timeline,
  TimelineItem,
  ActivityFeed,
  ActivityFeedItem,
} from '../components/ui';
import { useTheme } from '../lib/theme';
import {
  Layers,
  Sparkles,
  Search,
  Mail,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  TrendingUp,
  Inbox,
  Clock,
  Shield,
} from 'lucide-react';

export const DesignSystemShowcase: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { showToast } = useToast();

  // Component state demos
  const [inputValue, setInputValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [radioSelected, setRadioSelected] = useState('option-1');
  const [switchChecked, setSwitchChecked] = useState(true);
  const [progressVal, setProgressVal] = useState(65);
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [errorRetried, setErrorRetried] = useState(false);

  return (
    <div className="space-y-12 pb-16">
      {/* Header */}
      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Design System Showcase
              </h1>
              <Badge variant="info">QA & Inspection</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Internal development showcase for verifying design tokens, typography, and UI primitives.
            </p>
          </div>

          {/* Theme Quick Controls */}
          <div className="flex items-center gap-2 bg-surface-2 p-1 rounded border border-border-subtle self-start">
            <Button
              variant={theme === 'light' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTheme('light')}
              leftIcon={<Sun className="w-3.5 h-3.5" />}
            >
              Light
            </Button>
            <Button
              variant={theme === 'dark' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTheme('dark')}
              leftIcon={<Moon className="w-3.5 h-3.5" />}
            >
              Dark
            </Button>
            <Button
              variant={theme === 'system' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setTheme('system')}
              leftIcon={<Laptop className="w-3.5 h-3.5" />}
            >
              System ({resolvedTheme})
            </Button>
          </div>
        </div>
      </div>

      {/* 1. Color Palette Tokens */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">1. Design Tokens & Colors</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded border border-border bg-background space-y-1">
            <div className="h-6 rounded bg-background border border-border" />
            <p className="font-semibold">Background</p>
            <p className="text-[10px] font-mono text-muted-foreground">--background</p>
          </div>
          <div className="p-3 rounded border border-border bg-surface space-y-1">
            <div className="h-6 rounded bg-surface border border-border" />
            <p className="font-semibold">Surface</p>
            <p className="text-[10px] font-mono text-muted-foreground">--surface</p>
          </div>
          <div className="p-3 rounded border border-border bg-surface-2 space-y-1">
            <div className="h-6 rounded bg-surface-2 border border-border" />
            <p className="font-semibold">Surface 2</p>
            <p className="text-[10px] font-mono text-muted-foreground">--surface-2</p>
          </div>
          <div className="p-3 rounded border border-border bg-surface space-y-1">
            <div className="h-6 rounded bg-primary text-primary-foreground flex items-center justify-center font-mono text-[10px]" />
            <p className="font-semibold">Primary</p>
            <p className="text-[10px] font-mono text-muted-foreground">--primary</p>
          </div>
          <div className="p-3 rounded border border-border bg-surface space-y-1">
            <div className="h-6 rounded bg-secondary text-secondary-foreground" />
            <p className="font-semibold">Secondary</p>
            <p className="text-[10px] font-mono text-muted-foreground">--secondary</p>
          </div>
          <div className="p-3 rounded border border-border bg-surface space-y-1">
            <div className="h-6 rounded bg-border border" />
            <p className="font-semibold">Border</p>
            <p className="text-[10px] font-mono text-muted-foreground">--border</p>
          </div>
        </div>
      </section>

      {/* 2. Typography Scale */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">2. Typography Hierarchy</h2>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Display / H1</span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Plan. Execute. Evolve.
              </h1>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">H2 — Section Title</span>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Personal Operating System Architecture
              </h2>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">H3 — Card Title</span>
              <h3 className="text-base font-semibold text-foreground">Focus Session Parameters</h3>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Body Text</span>
              <p className="text-sm text-foreground leading-relaxed">
                Avenza creates a calm, intelligent foundation for technical work, academic rigor, and deliberate practice.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Body Small & Caption</span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Secondary metadata description for quiet context without distraction.
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Monospace Technical Text</span>
              <p className="font-mono text-xs text-foreground">
                sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Buttons */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">3. Button Variants & Sizes</h2>
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="link">Link Button</Button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Small (sm)</Button>
              <Button size="md">Medium (md)</Button>
              <Button size="lg">Large (lg)</Button>
              <IconButton icon={<Sparkles className="w-4 h-4" />} aria-label="Action" />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" isLoading>
                Loading Primary
              </Button>
              <Button variant="secondary" isLoading>
                Loading Secondary
              </Button>
              <Button variant="primary" disabled>
                Disabled
              </Button>
              <Button variant="primary" leftIcon={<Mail className="w-4 h-4" />}>
                With Left Icon
              </Button>
              <Tooltip content="Tooltip helper text on button">
                <Button variant="outline">Hover for Tooltip</Button>
              </Tooltip>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 4. Badges */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">4. Status Badges</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default">default</Badge>
          <Badge variant="secondary">secondary</Badge>
          <Badge variant="success">success</Badge>
          <Badge variant="warning">warning</Badge>
          <Badge variant="danger">danger</Badge>
          <Badge variant="info">info</Badge>
          <Badge variant="default" size="md">
            medium-size badge
          </Badge>
        </div>
      </section>

      {/* 5. Form Primitives */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">5. Form Primitives</h2>
        <Card>
          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <Input
              label="Standard Input"
              placeholder="e.g. Systems Programming"
              description="Enter course or topic title"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />

            <Input
              label="Input with Left Icon"
              placeholder="Search documents..."
              leftIcon={<Search className="w-4 h-4" />}
            />

            <Input
              label="Input with Error Validation"
              value="invalid@email"
              error="Please enter a valid academic email address."
            />

            <Select
              label="Select Dropdown"
              description="Choose an execution mode"
              options={[
                { label: 'Deep Focus Mode', value: 'deep_focus' },
                { label: 'Standard Mode', value: 'standard' },
                { label: 'Review Mode', value: 'review' },
              ]}
            />

            <div className="md:col-span-2">
              <Textarea
                label="Textarea"
                description="Supports multiple lines of technical notes"
                placeholder="Write reflection notes here..."
              />
            </div>

            <div className="space-y-3">
              <Checkbox
                label="Enable Hardware Acceleration"
                description="Optimizes rendering pipelines"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
              />
              <Checkbox
                label="Disabled Checkbox"
                description="This option cannot be modified"
                disabled
              />
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Radio
                  name="demo-radio"
                  label="Option Alpha"
                  description="Primary execution branch"
                  checked={radioSelected === 'option-1'}
                  onChange={() => setRadioSelected('option-1')}
                />
                <Radio
                  name="demo-radio"
                  label="Option Beta"
                  description="Alternative secondary branch"
                  checked={radioSelected === 'option-2'}
                  onChange={() => setRadioSelected('option-2')}
                />
              </div>

              <div className="pt-2">
                <Switch
                  label="Telemetry Stream"
                  description="Transmit anonymous performance traces"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6. Card & Stat System */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">6. Card & Stat System</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Active Focus Time"
            value="4h 15m"
            trend={{ value: '+12%', isPositive: true }}
            icon={<Clock className="w-4 h-4" />}
          />
          <Stat
            label="Security Audits"
            value="100%"
            trend={{ value: 'Passing', isPositive: true }}
            icon={<Shield className="w-4 h-4" />}
          />
          <Stat
            label="Error Rate"
            value="0.02%"
            trend={{ value: '-0.01%', isPositive: true }}
            icon={<TrendingUp className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Default Card Structure</CardTitle>
              <CardDescription>
                CardHeader, CardTitle, and CardDescription provide cohesive hierarchy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                CardContent hosts arbitrary nested components or tables with restrained padding.
              </p>
            </CardContent>
            <CardFooter className="justify-between text-xs text-muted-foreground">
              <span>Status: Active</span>
              <Button size="sm" variant="outline">
                Details
              </Button>
            </CardFooter>
          </Card>

          <Card variant="subtle">
            <CardHeader>
              <CardTitle>Subtle Card Variant</CardTitle>
              <CardDescription>For lower-contrast secondary groupings.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Subtle cards use surface-2 backgrounds without outer borders.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 7. Progress & Indicators */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">7. Progress Indicators</h2>
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Progress value={progressVal} label="Execution Progress" showValue />
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setProgressVal(Math.max(0, progressVal - 15))}>
                  -15%
                </Button>
                <Button size="sm" variant="outline" onClick={() => setProgressVal(Math.min(100, progressVal + 15))}>
                  +15%
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <Progress isIndeterminate label="Indeterminate Operation" />
            </div>

            <div className="space-y-1">
              <Progress value={85} compact label="Compact Bar" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 8. Table Primitive */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">8. Table Foundation</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Identifier</TableHead>
              <TableHead>Target Module</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Timestamp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>MOD-001</TableCell>
              <TableCell className="font-sans font-medium">Identity & Auth System</TableCell>
              <TableCell>
                <Badge variant="success">Completed</Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">2026-10-02</TableCell>
            </TableRow>
            <TableRow isSelected>
              <TableCell>MOD-002</TableCell>
              <TableCell className="font-sans font-medium">Shell & Design System</TableCell>
              <TableCell>
                <Badge variant="info">In Review</Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">2026-10-02</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>MOD-003</TableCell>
              <TableCell className="font-sans font-medium">Planner Foundation</TableCell>
              <TableCell>
                <Badge variant="secondary">Upcoming</Badge>
              </TableCell>
              <TableCell className="text-right text-muted-foreground">Planned</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <p className="text-xs text-muted-foreground font-mono">Empty Table State Demo:</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column A</TableHead>
              <TableHead>Column B</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty colSpan={2}>No records in demonstration container.</TableEmpty>
          </TableBody>
        </Table>
      </section>

      {/* 9. Tabs & Pagination */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">9. Tabs & Pagination</h2>
        <Card>
          <CardContent className="p-5 space-y-6">
            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="specifications">Specifications</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="p-3 bg-surface-2/40 rounded border border-border-subtle text-xs">
                Overview tab panel content displaying concise structure.
              </TabsContent>
              <TabsContent value="specifications" className="p-3 bg-surface-2/40 rounded border border-border-subtle text-xs">
                Specifications panel content demonstrating accessible ARIA tab switching.
              </TabsContent>
              <TabsContent value="activity" className="p-3 bg-surface-2/40 rounded border border-border-subtle text-xs">
                Activity panel tab content.
              </TabsContent>
            </Tabs>

            <div className="pt-2 border-t border-border-subtle">
              <Pagination
                currentPage={currentPage}
                totalPages={5}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 10. Alerts & Feedback */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">10. Alerts & Notification Toasts</h2>
        <div className="space-y-3">
          <Alert variant="info" title="System Notice">
            Design tokens strictly mirror the Avenza palette across all surfaces.
          </Alert>
          <Alert variant="success" title="Verification Passed">
            All design primitives verified against accessibility standards.
          </Alert>
          <Alert variant="warning" title="Restrained Geometry">
            Border radii are strictly capped between 4px and 12px.
          </Alert>
          <Alert variant="danger" title="Boundary Enforcement">
            No business logic or fake data may be introduced in Phase 4.
          </Alert>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              showToast({
                type: 'success',
                title: 'Operation successful',
                message: 'Preferences saved cleanly.',
              })
            }
          >
            Trigger Success Toast
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              showToast({
                type: 'error',
                title: 'Network timeout',
                message: 'Unable to connect to endpoint.',
              })
            }
          >
            Trigger Error Toast
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              showToast({
                type: 'warning',
                title: 'Unsaved Changes',
                message: 'Please review modified inputs.',
              })
            }
          >
            Trigger Warning Toast
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              showToast({
                type: 'info',
                title: 'System Information',
                message: 'Avenza shell initialized.',
              })
            }
          >
            Trigger Info Toast
          </Button>
        </div>
      </section>

      {/* 11. States: Loading, Empty, Error */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          11. Empty, Error, and Loading States
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <EmptyState
            icon={<Inbox className="w-5 h-5 text-muted-foreground" />}
            title="No Items Yet"
            description="Structural empty state ready for future domain data."
            action={
              <Button size="sm" variant="outline">
                Add Item
              </Button>
            }
          />

          <ErrorState
            title="Connection Error"
            description={errorRetried ? 'Retry triggered successfully!' : 'Failed to query database schema.'}
            onRetry={() => setErrorRetried(true)}
            retryLabel={errorRetried ? 'Retry Again' : 'Retry'}
          />

          <Card>
            <CardHeader>
              <CardTitle>Skeleton Loaders</CardTitle>
              <CardDescription>Restrained loading animations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
              <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                <Spinner size="sm" />
                <span>Active background process</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 12. Modal & Confirmation Dialogs */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          12. Modal & Dialog Primitives
        </h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            Open Sample Modal
          </Button>
          <Button variant="danger" onClick={() => setIsConfirmOpen(true)}>
            Open Confirmation Dialog
          </Button>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Demonstration Modal"
          description="Accessible modal dialog with Escape close and focus trap."
        >
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              This dialog implements focus management, accessible labels, overlay backdrop, and keyboard navigation.
            </p>
            <Input label="Sample Modal Input" placeholder="Type here..." />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsModalOpen(false);
                  showToast({ type: 'success', title: 'Action confirmed' });
                }}
              >
                Accept
              </Button>
            </div>
          </div>
        </Modal>

        <ConfirmationDialog
          isOpen={isConfirmOpen}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={() => {
            setIsConfirmOpen(false);
            showToast({ type: 'info', title: 'Confirmed deletion action' });
          }}
          title="Delete Confirmation"
          message="Are you sure you wish to delete this demonstration item? This action demonstrates the confirmation primitive."
          confirmLabel="Delete"
          variant="danger"
        />
      </section>

      {/* 13. Timeline & Activity Feed */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          13. Timeline & Activity Feed Foundations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Milestone Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline>
                <TimelineItem
                  title="Phase 1 — Repository & Tooling"
                  time="Completed"
                  description="Turborepo monorepo, Fastify, React/Vite, Tailwind, TypeScript."
                />
                <TimelineItem
                  title="Phase 2 — Supabase Foundation"
                  time="Completed"
                  description="PostgreSQL schema, profiles, user_preferences, RLS policies."
                />
                <TimelineItem
                  title="Phase 3 — Clerk Authentication"
                  time="Completed"
                  description="Clerk identity flow, JWT token verification, /api/v1/auth/me."
                />
                <TimelineItem
                  title="Phase 4 — Shell & Design System"
                  time="In Progress"
                  description="Avenza visual identity, app shell, navigation, tokens, UI primitives."
                  isLast
                />
              </Timeline>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed>
                <ActivityFeedItem
                  actor="Aswin"
                  action="switched theme to"
                  target={theme}
                  timestamp="Just now"
                  icon={<Layers className="w-3.5 h-3.5" />}
                />
                <ActivityFeedItem
                  actor="System"
                  action="verified"
                  target="Design Tokens"
                  timestamp="5m ago"
                  icon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                />
                <ActivityFeedItem
                  actor="Security"
                  action="validated"
                  target="Clerk Session Tokens"
                  timestamp="12m ago"
                  icon={<Shield className="w-3.5 h-3.5 text-sky-500" />}
                />
              </ActivityFeed>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};
