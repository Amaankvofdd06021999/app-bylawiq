'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, PageHeading, Input, Select, Card } from '@/components/ui';
import { useBackend } from '@/components/backend';
import {
  startOnboardingAction,
  addOnboardingBuildingAction,
  addOnboardingTeamMemberAction,
  completeOnboardingAction,
} from '../actions';

type Step = 1 | 2 | 3 | 4 | 5;

interface WorkflowState {
  firmName: string;
  firmType: 'independent' | 'management_firm';
  buildings: Array<{ name: string; jurisdiction: string; residents: number }>;
  teamMembers: Array<{ email: string; role: string }>;
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
          setError(result.error);
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
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const addTeamMember = async (email: string, role: string) => {
    if (!workflowId) return;
    setBusy(true);
    try {
      const result = await addOnboardingTeamMemberAction({
        workflowId,
        email,
        role: role as any,
      });
      if (result.ok) {
        setState((s) => ({
          ...s,
          teamMembers: [...s.teamMembers, { email, role }],
        }));
      } else {
        setError(result.error);
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
        setError(result.error);
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
          step === 1 ? 'Create a new firm' :
          step === 2 ? 'Add buildings' :
          step === 3 ? 'Add team members' :
          step === 4 ? 'Configure settings' :
          'Review and complete'
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
              onChange={(e) =>
                setState((s) => ({ ...s, firmType: e.target.value as any }))
              }
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
                <p>{b.jurisdiction} · {b.residents} residents</p>
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
          {/* TODO: Add settings form */}
        </Card>
      )}

      {step === 5 && (
        <Card>
          <h3>Review & Complete</h3>
          <dl className="kv-grid">
            <div>
              <dt>Firm</dt>
              <dd>{state.firmName} ({state.firmType})</dd>
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
          <Button
            variant="ghost"
            onClick={() => setStep((step - 1) as Step)}
            disabled={busy}
          >
            Back
          </Button>
        )}
        {step < 5 && (
          <Button
            onClick={handleNextStep}
            busy={busy}
            disabled={step === 1 && !state.firmName}
          >
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
        <Input
          type="number"
          value={residents}
          onChange={(e) => setResidents(Number(e.target.value))}
        />
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
  onAdd: (email: string, role: string) => void;
  busy: boolean;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('org_admin');

  return (
    <Card>
      <div className="form-group">
        <label>Email</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Role</label>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
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
