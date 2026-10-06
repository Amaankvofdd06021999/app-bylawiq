'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui';
import { useBackend } from '@/components/backend';
export function JoinBuildingForm({
  firms,
  initialCode = '',
}: {
  firms: { id: string; name: string }[];
  initialCode?: string;
}) {
  const router = useRouter(),
    backend = useBackend();
  const [code, setCode] = useState(initialCode),
    [firm, setFirm] = useState(firms[0]?.id || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialCode) window.history.replaceState(null, '', backend.base + '/workspace');
  }, [initialCode, backend.base]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await backend.acceptFirmCode({ code, firmOrgId: firm });
    setBusy(false);
    if (r.ok) router.push(backend.base + '/b/' + r.buildingId + '/ask');
    else setError(r.error);
  }
  return (
    <section className="card" aria-labelledby="join-building-heading">
      <h2 id="join-building-heading">
        <KeyRound size={18} /> Join a building
      </h2>
      <p className="form-note">
        Enter the code the building gave you. Everyone at your firm gets access once it’s accepted.
      </p>
      <form onSubmit={submit} className="form-stack" style={{ marginTop: 16 }}>
        <label>
          Building code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="ABCD-EFGH"
            autoComplete="off"
            autoCapitalize="characters"
            required
            maxLength={20}
            aria-describedby={error ? 'join-building-error' : undefined}
          />
        </label>
        {firms.length > 1 && (
          <label>
            Firm
            <select value={firm} onChange={(e) => setFirm(e.target.value)}>
              {firms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && (
          <p id="join-building-error" role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !code.trim()}>
          {busy ? 'Joining…' : 'Join building'}
        </Button>
      </form>
    </section>
  );
}
