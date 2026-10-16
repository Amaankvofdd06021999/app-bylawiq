'use client';
import { useState } from 'react';
import { createResidentDraftAction } from '../draft-actions';
import type { DraftInput, ResidentDraftView } from '../types';

export function useDraftTool() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ResidentDraftView | null>(null);
  const [paywall, setPaywall] = useState(false);
  const [paywallCredits, setPaywallCredits] = useState<number | undefined>(undefined);

  async function submit(input: DraftInput) {
    setBusy(true);
    setError(null);
    setDraft(null);
    const result = await createResidentDraftAction(input);
    setBusy(false);
    if (result.ok) {
      setDraft(result.draft);
      return;
    }
    if (result.paywall) {
      setPaywallCredits(result.credits);
      setPaywall(true);
      return;
    }
    setError(result.error);
  }

  return {
    submit,
    busy,
    error,
    draft,
    paywall,
    paywallCredits,
    closePaywall: () => setPaywall(false),
  };
}
