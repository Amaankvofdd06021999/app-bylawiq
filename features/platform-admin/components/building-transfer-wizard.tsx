'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Building,
} from 'lucide-react';
import { Button, PageHeading, Card, Badge } from '@/components/ui';
import {
  getBuildingTransferCandidatesAction,
  getFirmTransferDestinationsAction,
  getFirmManagersAction,
  transferBuildingFirmAction,
} from '../actions';

interface BuildingCandidate {
  building_id: string;
  building_name: string;
  strata_plan_no: string | null;
  unit_count: number | null;
  current_firm_id: string | null;
  current_firm_name: string | null;
  link_id: string | null;
  linked_since: string | null;
}

interface DestinationFirm {
  firm_id: string;
  firm_name: string;
  active_building_count: number;
  active_member_count: number;
}

interface FirmManager {
  user_id: string;
  email: string;
  role: string;
  display_name: string;
}

interface TransferResult {
  ok: boolean;
  building_id: string;
  building_name: string;
  former_firm_name: string | null;
  new_firm_name: string;
  new_link_id: string;
  suspended_members_count: number;
}

export function BuildingTransferWizard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<BuildingCandidate[]>([]);
  const [firms, setFirms] = useState<DestinationFirm[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selection state
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingCandidate | null>(null);
  const [selectedFirmId, setSelectedFirmId] = useState<string>('');
  const [firmManagers, setFirmManagers] = useState<FirmManager[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>('');
  const [loadingManagers, setLoadingManagers] = useState(false);

  // Execution state
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState<TransferResult | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      setError('');
      try {
        const [candRes, firmsRes] = await Promise.all([
          getBuildingTransferCandidatesAction(),
          getFirmTransferDestinationsAction(),
        ]);

        if (candRes.ok && candRes.candidates) {
          setCandidates(candRes.candidates as BuildingCandidate[]);
        } else {
          setError(candRes.error || 'Failed to load buildings');
        }

        if (firmsRes.ok && firmsRes.firms) {
          setFirms(firmsRes.firms as DestinationFirm[]);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error loading initial data');
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  const handleFirmChange = async (firmId: string) => {
    setSelectedFirmId(firmId);
    setSelectedManagerId('');
    if (!firmId) {
      setFirmManagers([]);
      return;
    }

    setLoadingManagers(true);
    try {
      const res = await getFirmManagersAction({ firmId });
      if (res.ok && res.managers) {
        setFirmManagers(res.managers as FirmManager[]);
      } else {
        setFirmManagers([]);
      }
    } catch {
      setFirmManagers([]);
    } finally {
      setLoadingManagers(false);
    }
  };

  const filteredCandidates = candidates.filter((b) => {
    const q = searchQuery.toLowerCase();
    return (
      b.building_name.toLowerCase().includes(q) ||
      (b.strata_plan_no && b.strata_plan_no.toLowerCase().includes(q)) ||
      (b.current_firm_name && b.current_firm_name.toLowerCase().includes(q))
    );
  });

  const availableDestinations = firms.filter(
    (f) => !selectedBuilding || f.firm_id !== selectedBuilding.current_firm_id
  );

  const handleTransfer = async () => {
    if (!selectedBuilding || !selectedFirmId) return;

    setError('');
    setBusy(true);

    try {
      const res = await transferBuildingFirmAction({
        buildingId: selectedBuilding.building_id,
        targetFirmOrgId: selectedFirmId,
        targetManagerUserId: selectedManagerId || null,
      });

      if (!res.ok) {
        setError(res.error || 'Failed to transfer building');
        setBusy(false);
        return;
      }

      setTransferSuccess(res.result as TransferResult);
      // Refresh candidates list in background
      const refreshed = await getBuildingTransferCandidatesAction();
      if (refreshed.ok && refreshed.candidates) {
        setCandidates(refreshed.candidates as BuildingCandidate[]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unexpected error during transfer');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    setSelectedBuilding(null);
    setSelectedFirmId('');
    setSelectedManagerId('');
    setTransferSuccess(null);
    setError('');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <RefreshCw style={{ animation: 'spin 1s linear infinite', width: 28, height: 28, margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-muted, #64748b)' }}>Loading buildings and management firms...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '1rem' }}>
      <PageHeading
        title="Transfer Building Management"
        description="Seamlessly and safely reassign a strata corporation from one brokerage to another under Section 35 of the BC Strata Property Act."
      />

      {error && (
        <div
          role="alert"
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'var(--bg-danger-subtle, #fef2f2)',
            border: '1px solid var(--border-danger, #f87171)',
            borderRadius: 8,
            color: 'var(--text-danger, #991b1b)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle style={{ width: 20, height: 20, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {transferSuccess ? (
        <Card style={{ marginTop: '2rem', padding: '2.5rem', textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: '#059669',
            }}
          >
            <CheckCircle2 style={{ width: 36, height: 36 }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Building Management Transferred Successfully!
          </h2>
          <p style={{ color: 'var(--text-muted, #64748b)', maxWidth: 600, margin: '0 auto 2rem' }}>
            <strong>{transferSuccess.building_name}</strong> is now officially under management by{' '}
            <strong>{transferSuccess.new_firm_name}</strong>.
          </p>

          <div
            style={{
              background: 'var(--bg-subtle, #f8fafc)',
              borderRadius: 8,
              padding: '1.5rem',
              maxWidth: 550,
              margin: '0 auto 2rem',
              textAlign: 'left',
              border: '1px solid var(--border, #e2e8f0)',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Outgoing Firm</span>
                <p style={{ fontWeight: 500, margin: '0.25rem 0 0' }}>
                  {transferSuccess.former_firm_name || 'None (Self-managed)'}
                </p>
                <div>
                  <Badge tone="neutral">Access Revoked</Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase' }}>Incoming Firm</span>
                <p style={{ fontWeight: 500, margin: '0.25rem 0 0' }}>{transferSuccess.new_firm_name}</p>
                <div>
                  <Badge tone="ai">Active Management</Badge>
                </div>
              </div>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', fontSize: '0.875rem' }}>
              ✓ All bylaws, units, council minutes, and CRT records preserved.<br />
              ✓ New firm SOPs and RAG pipeline attached.<br />
              ✓ Action recorded in immutable Platform Audit Log.
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button onClick={handleReset} variant="secondary">
              Transfer Another Building
            </Button>
            <Button onClick={() => router.push('/admin/buildings')}>
              View All Buildings
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: selectedBuilding ? '1.2fr 1.8fr' : '1fr', gap: '2rem' }}>
          {/* Step 1: Select Building */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 style={{ width: 18, height: 18 }} />
              1. Select Strata Building
            </h3>
            
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  color: '#94a3b8',
                }}
              />
              <input
                type="text"
                placeholder="Search by building name or plan #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                  borderRadius: 6,
                  border: '1px solid var(--border, #cbd5e1)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div
              style={{
                maxHeight: 480,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                paddingRight: '0.25rem',
              }}
            >
              {filteredCandidates.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 0', fontSize: '0.9rem' }}>
                  No matching buildings found.
                </p>
              ) : (
                filteredCandidates.map((b) => {
                  const isSelected = selectedBuilding?.building_id === b.building_id;
                  return (
                    <div
                      key={b.building_id}
                      onClick={() => {
                        setSelectedBuilding(b);
                        setSelectedFirmId('');
                        setSelectedManagerId('');
                        setError('');
                      }}
                      style={{
                        padding: '0.85rem 1rem',
                        borderRadius: 8,
                        border: isSelected
                          ? '2px solid var(--primary, #2563eb)'
                          : '1px solid var(--border, #e2e8f0)',
                        background: isSelected ? 'var(--bg-accent, #eff6ff)' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem' }}>{b.building_name}</strong>
                          {b.strata_plan_no && (
                            <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.5rem' }}>
                              ({b.strata_plan_no})
                            </span>
                          )}
                        </div>
                        {b.unit_count !== null && (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {b.unit_count} units
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Building style={{ width: 14, height: 14 }} />
                        <span>
                          {b.current_firm_name ? (
                            <>Managing firm: <strong>{b.current_firm_name}</strong></>
                          ) : (
                            <em style={{ color: '#94a3b8' }}>Self-managed / unlinked</em>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Step 2: Configure Transfer Details */}
          {selectedBuilding && (
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRight style={{ width: 18, height: 18 }} />
                2. Configure Brokerage Transfer
              </h3>

              <Card style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Selected Building
                    </span>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0.1rem 0' }}>
                      {selectedBuilding.building_name}
                    </h4>
                  </div>
                  <Badge tone={selectedBuilding.current_firm_name ? 'neutral' : 'warning'}>
                    {selectedBuilding.current_firm_name ? `Current: ${selectedBuilding.current_firm_name}` : 'No Managing Firm'}
                  </Badge>
                </div>

                {/* Target Firm Selector */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    Select New Management Firm <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={selectedFirmId}
                    onChange={(e) => handleFirmChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.75rem',
                      borderRadius: 6,
                      border: '1px solid var(--border, #cbd5e1)',
                      fontSize: '0.9rem',
                      backgroundColor: '#fff',
                    }}
                  >
                    <option value="">-- Choose destination firm --</option>
                    {availableDestinations.map((f) => (
                      <option key={f.firm_id} value={f.firm_id}>
                        {f.firm_name} ({f.active_building_count} managed buildings)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Designated Manager Picker */}
                {selectedFirmId && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      Designate Lead Portfolio Manager <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    {loadingManagers ? (
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Loading firm staff...</p>
                    ) : firmManagers.length > 0 ? (
                      <select
                        value={selectedManagerId}
                        onChange={(e) => setSelectedManagerId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem',
                          borderRadius: 6,
                          border: '1px solid var(--border, #cbd5e1)',
                          fontSize: '0.9rem',
                          backgroundColor: '#fff',
                        }}
                      >
                        <option value="">-- Auto-enroll all firm managers --</option>
                        {firmManagers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.display_name} ({m.email}) - {m.role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        No specific team members found. All future firm staff will be auto-linked.
                      </p>
                    )}
                  </div>
                )}

                {/* Safety Guarantee Callout */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    padding: '1rem',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                    <ShieldCheck style={{ width: 18, height: 18 }} />
                    Zero Data Loss & Strict Isolation Guarantee
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.825rem', color: '#14532d', lineHeight: '1.45' }}>
                    <li><strong>Bylaws & Records:</strong> Strata property records remain 100% intact under SPA s.35.</li>
                    <li><strong>Instant RLS Cut-off:</strong> Former firm staff are revoked immediately upon transfer.</li>
                    <li><strong>Knowledge Base Binding:</strong> New firm&apos;s Tier 2 SOPs immediately attach to future queries.</li>
                  </ul>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <Button variant="secondary" onClick={handleReset} disabled={busy}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleTransfer}
                    disabled={!selectedFirmId || busy}
                  >
                    {busy ? 'Executing Transfer...' : 'Confirm & Transfer Management'}
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
