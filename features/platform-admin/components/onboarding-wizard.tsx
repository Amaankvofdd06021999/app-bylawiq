'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, PageHeading, Input, Select, Card } from '@/components/ui';
import {
  startOnboardingAction,
  addOnboardingBuildingAction,
  addOnboardingTeamMemberAction,
  completeOnboardingAction,
} from '../actions';

type Step = 1 | 2 | 3 | 4 | 5;

// The values the server actions accept (see features/platform-admin/actions.ts), so a bad value never gets through.
const FIRM_TYPES = ['independent', 'management_firm'] as const;
type FirmType = (typeof FIRM_TYPES)[number];
const TEAM_ROLES = ['org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant'] as const;
type TeamRole = (typeof TEAM_ROLES)[number];
function isFirmType(v: string): v is FirmType {
  return (FIRM_TYPES as readonly string[]).includes(v);
}
function isTeamRole(v: string): v is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(v);
}

interface WorkflowState {
  firmName: string;
  firmType: FirmType;
  buildings: Array<{ name: string; jurisdiction: string; residents: number }>;
  teamMembers: Array<{ email: string; role: TeamRole }>;
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [state, setState] = useState<WorkflowState>({
    firmName: '',
    firmType: 'management_firm',
    buildings: [],
    teamMembers: [],
  });

  const handleNextStep = async () => {
    setError('');
    setBusy(true);

    try {
      if (step === 1) {
        // Start onboarding
        const result = await startOnboardingAction({
          firmName: state.firmName,
          firmType: state.firmType,
        });
        if (!result.ok) {
          setError(result.error ?? 'Something went wrong. Please try again.');
          setBusy(false);
          return;
        }
        setWorkflowId(result.workflowId);
      }

      setStep((step + 1) as Step);
    } finally {
      setBusy(false);
    }
  };

  const addBuilding = async (name: string, jurisdiction: string, residents: number) => {
    if (!workflowId) return;
    setBusy(true);
    try {
      const result = await addOnboardingBuildingAction({
        workflowId,
        buildingName: name,
        jurisdiction,
        residentCount: residents,
      });
      if (result.ok) {
        setState((s) => ({
          ...s,
          buildings: [...s.buildings, { name, jurisdiction, residents }],
        }));
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const addTeamMember = async (email: string, role: TeamRole) => {
    if (!workflowId) return;
    setBusy(true);
    try {
      const result = await addOnboardingTeamMemberAction({
        workflowId,
        email,
        role,
      });
      if (result.ok) {
        setState((s) => ({
          ...s,
          teamMembers: [...s.teamMembers, { email, role }],
        }));
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!workflowId) return;
    setBusy(true);
    try {
      const result = await completeOnboardingAction({ workflowId });
      if (result.ok) {
        router.push('/admin?notice=onboarding_complete');
      } else {
        setError(result.error ?? 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-wizard">
      <PageHeading
        eyebrow="Firm Onboarding"
        title={`Step ${step} of 5`}
        description={
          step === 1
            ? 'Create a new firm'
            : step === 2
              ? 'Add buildings'
              : step === 3
                ? 'Add team members'
                : step === 4
                  ? 'Configure settings'
                  : 'Review and complete'
        }
      />

      {error && <p className="form-error">{error}</p>}

      {step === 1 && (
        <Card>
          <div className="form-group">
            <label>Firm name</label>
            <Input
              type="text"
              value={state.firmName}
              onChange={(e) => setState((s) => ({ ...s, firmName: e.target.value }))}
              placeholder="Acme Strata Management"
            />
          </div>
          <div className="form-group">
            <label>Firm type</label>
            <Select
              value={state.firmType}
              onChange={(e) => {
                const v = e.target.value;
                if (isFirmType(v)) setState((s) => ({ ...s, firmType: v }));
              }}
            >
              <option value="management_firm">Strata Management Firm</option>
              <option value="independent">Independent Building</option>
            </Select>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div>
          <AddBuildingForm onAdd={addBuilding} busy={busy} />
          <div className="building-list">
            {state.buildings.map((b, i) => (
              <Card key={i}>
                <h3>{b.name}</h3>
                <p>
                  {b.jurisdiction} · {b.residents} residents
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <AddTeamMemberForm onAdd={addTeamMember} busy={busy} />
          <div className="team-list">
            {state.teamMembers.map((m, i) => (
              <Card key={i}>
                <p>{m.email}</p>
                <small>{m.role}</small>
              </Card>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <Card>
          <h3>Settings</h3>
          <p>Configure billing, team access levels, and feature flags for this firm.</p>

          <div className="settings-form">
            <div className="form-group">
              <label htmlFor="plan">Plan Selection</label>
              <select
                id="plan"
                value={state.firmType}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isFirmType(v)) setState((s) => ({ ...s, firmType: v }));
                }}
                className="form-control"
              >
                <option value="independent">Independent Firm ($99/mo)</option>
                <option value="management_firm">Strata Management Firm ($199/mo)</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                <input type="checkbox" defaultChecked />
                Enable AI Chat for residents
              </label>
              <small>Residents can ask questions about bylaws</small>
            </div>

            <div className="form-group">
              <label>
                <input type="checkbox" defaultChecked />
                Enable Analytics Dashboard
              </label>
              <small>Track chat usage and metrics</small>
            </div>

            <div className="form-group">
              <label>
                <input type="checkbox" />
                Enable Resident Mobile App
              </label>
              <small>Residents access via mobile app</small>
            </div>
          </div>

          <style jsx>{`
            .settings-form {
              display: flex;
              flex-direction: column;
              gap: 1.5rem;
              margin-top: 1.5rem;
              padding: 1rem;
              background: #f9fafb;
              border-radius: 6px;
            }

            .form-group {
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }

            .form-group label {
              font-weight: 500;
              color: #1f2937;
              display: flex;
              align-items: center;
              gap: 0.75rem;
              cursor: pointer;
            }

            .form-group input[type='checkbox'] {
              width: 18px;
              height: 18px;
              cursor: pointer;
            }

            .form-group select {
              padding: 0.75rem;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.95rem;
            }

            .form-group small {
              color: #666;
              font-size: 0.875rem;
            }
          `}</style>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <h3>Review & Complete</h3>
          <dl className="kv-grid">
            <div>
              <dt>Firm</dt>
              <dd>
                {state.firmName} ({state.firmType})
              </dd>
            </div>
            <div>
              <dt>Buildings</dt>
              <dd>{state.buildings.length}</dd>
            </div>
            <div>
              <dt>Team members</dt>
              <dd>{state.teamMembers.length}</dd>
            </div>
          </dl>
        </Card>
      )}

      <div className="form-actions" style={{ marginTop: 24 }}>
        {step > 1 && (
          <Button variant="ghost" onClick={() => setStep((step - 1) as Step)} disabled={busy}>
            Back
          </Button>
        )}
        {step < 5 && (
          <Button onClick={handleNextStep} busy={busy} disabled={step === 1 && !state.firmName}>
            Next
          </Button>
        )}
        {step === 5 && (
          <Button onClick={handleComplete} busy={busy}>
            Complete Onboarding
          </Button>
        )}
      </div>
    </div>
  );
}

function AddBuildingForm({
  onAdd,
  busy,
}: {
  onAdd: (name: string, jurisdiction: string, residents: number) => void;
  busy: boolean;
}) {
  const [name, setName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('BC');
  const [residents, setResidents] = useState(50);

  return (
    <Card>
      <div className="form-group">
        <label>Building name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Jurisdiction</label>
        <Select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
          <option value="BC">British Columbia</option>
          <option value="AB">Alberta</option>
          <option value="ON">Ontario</option>
        </Select>
      </div>
      <div className="form-group">
        <label>Resident count</label>
        <Input type="number" value={residents} onChange={(e) => setResidents(Number(e.target.value))} />
      </div>
      <Button
        onClick={() => {
          onAdd(name, jurisdiction, residents);
          setName('');
        }}
        disabled={!name || busy}
      >
        Add Building
      </Button>
    </Card>
  );
}

function AddTeamMemberForm({
  onAdd,
  busy,
}: {
  onAdd: (email: string, role: TeamRole) => void;
  busy: boolean;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamRole>('org_admin');

  return (
    <Card>
      <div className="form-group">
        <label>Email</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Role</label>
        <Select
          value={role}
          onChange={(e) => {
            if (isTeamRole(e.target.value)) setRole(e.target.value);
          }}
        >
          <option value="org_owner">Organization Owner</option>
          <option value="org_admin">Organization Admin</option>
          <option value="portfolio_manager">Portfolio Manager</option>
          <option value="portfolio_assistant">Portfolio Assistant</option>
        </Select>
      </div>
      <Button
        onClick={() => {
          onAdd(email, role);
          setEmail('');
        }}
        disabled={!email || busy}
      >
        Add Team Member
      </Button>
    </Card>
  );
}
