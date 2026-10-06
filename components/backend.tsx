'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { mutateAction } from '@/features/workspace/actions';
import {
  createFirmCodeAction,
  revokeFirmLinkAction,
  acceptFirmCodeAction,
} from '@/features/firm-links/actions';
import { createChatAction, branchChatAction } from '@/features/chat/actions';
import { signOutAction } from '@/features/auth/actions';
import type { DraftInput, DraftResult } from '@/features/residents/types';
import type { FirmDocInput } from '@/features/knowledge/types';
/** The seam between screens and whatever serves them: the real server actions and API, or the demo's mock ones. */
export type Backend = {
  base: '' | '/demo'; // prefix for app links: `${base}/b/${id}/${section}`, `${base}/workspace`
  api: '/api' | '/api/demo'; // prefix for upload, sources, download, export, chat
  mutate: typeof mutateAction;
  createFirmCode: typeof createFirmCodeAction;
  revokeFirmLink: typeof revokeFirmLinkAction;
  acceptFirmCode: typeof acceptFirmCodeAction;
  createChat: typeof createChatAction;
  branchChat: typeof branchChatAction;
  signOut: () => Promise<unknown>;
  /** Platform feature flags. Demo only for now: the real app has no flags table, so the default says so. */
  setFlag: (raw: {
    flag: 'residentAi';
    enabled: boolean;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Resident credits and drafting tools, and firm knowledge editing. Demo only for now: the real app has no
   * payments, resident drafting or firm knowledge tables yet, so each default says the feature isn't available. */
  buyCredits: (raw: {
    buildingId: string;
  }) => Promise<{ ok: true; credits: number } | { ok: false; error: string }>;
  residentDraft: (raw: DraftInput) => Promise<DraftResult>;
  saveFirmDoc: (raw: FirmDocInput) => Promise<{ ok: true; id: string } | { ok: false; error: string }>;
  deleteFirmDoc: (raw: { id: string }) => Promise<{ ok: true } | { ok: false; error: string }>;
};
const noFlags: Backend['setFlag'] = async () => ({ ok: false, error: 'Feature flags aren’t available yet.' });
const notYet = async (): Promise<{ ok: false; error: string }> => ({
  ok: false,
  error: 'This feature isn’t available yet.',
});
const real: Backend = {
  base: '',
  api: '/api',
  mutate: mutateAction,
  createFirmCode: createFirmCodeAction,
  revokeFirmLink: revokeFirmLinkAction,
  acceptFirmCode: acceptFirmCodeAction,
  createChat: createChatAction,
  branchChat: branchChatAction,
  signOut: signOutAction,
  setFlag: noFlags,
  buyCredits: notYet,
  residentDraft: notYet,
  saveFirmDoc: notYet,
  deleteFirmDoc: notYet,
};
const BackendContext = createContext<Backend>(real);
export function BackendProvider({ value, children }: { value: Backend; children: ReactNode }) {
  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}
/** Defaults to the real backend when no provider is present, so real pages need no wrapper. */
export function useBackend(): Backend {
  return useContext(BackendContext);
}
