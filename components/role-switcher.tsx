'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Building } from '@/lib/schema';
import type { AppRole } from '@/lib/schema';

/**
 * Role Switcher: Dropdown for multi-role users to switch their active session role.
 *
 * Shows only if user has 2+ roles across different buildings/orgs.
 * Switching rebuilds the session with a new JWT token.
 */
export function RoleSwitcher({
  currentBuilding: current,
  currentRole,
  allBuildings,
  onSwitch,
}: {
  currentBuilding: Building;
  currentRole: AppRole;
  allBuildings: Building[];
  onSwitch: (buildingId: string, role: AppRole) => Promise<void>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  // Only show if multi-role
  const rolesAcross = allBuildings.length > 1;
  if (!rolesAcross) return null;

  const handleSwitch = async (buildingId: string, role: AppRole) => {
    setIsSwitching(true);
    try {
      await onSwitch(buildingId, role);
      setIsOpen(false);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div className="role-switcher-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="role-switcher-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          background: 'var(--color-bg)',
          cursor: isSwitching ? 'not-allowed' : 'pointer',
          opacity: isSwitching ? 0.6 : 1,
        }}
      >
        <span className="role-label" style={{ fontSize: '14px', fontWeight: 500 }}>
          {currentRole.replace('_', ' ').charAt(0).toUpperCase() + currentRole.slice(1)}
        </span>
        <ChevronDown size={16} />
      </button>

      {isOpen && (
        <div
          className="role-switcher-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            minWidth: '280px',
          }}
          role="menu"
        >
          {allBuildings.map((building) => (
            <div
              key={building.id}
              className="role-switcher-building"
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--color-border-light)',
              }}
            >
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}
              >
                {building.name}
              </div>
              <button
                onClick={() => handleSwitch(building.id, 'building_manager' as AppRole)}
                disabled={isSwitching || (building.id === current.id && currentRole === 'building_manager')}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 0',
                  border: 'none',
                  background: 'none',
                  cursor: isSwitching ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  color:
                    building.id === current.id && currentRole === 'building_manager'
                      ? 'var(--color-text-secondary)'
                      : 'var(--color-text)',
                  opacity:
                    building.id === current.id && currentRole === 'building_manager' ? 0.5 : 1,
                }}
              >
                {building.id === current.id && currentRole === 'building_manager' && '✓ '}
                Building Manager
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Simple indicator when user has no multi-role capability.
 * Shows current role without switcher.
 */
export function RoleIndicator({ role, disabled = false }: { role: AppRole; disabled?: boolean }) {
  if (disabled) return null;

  return (
    <div
      className="role-indicator"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 10px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        textTransform: 'capitalize',
      }}
    >
      <span className="role-badge" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
      {role.replace('_', ' ')}
    </div>
  );
}
