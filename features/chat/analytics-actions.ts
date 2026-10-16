'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { errorMessage } from '@/lib/errors';
import {
  getBuildingChatAnalytics,
  getFirmChatAnalytics,
  getPlatformChatAnalytics,
} from './citations-analytics';

const BuildingInput = z.object({ buildingId: z.uuid() });
const FirmInput = z.object({ orgId: z.uuid() });

export async function loadBuildingChatAnalyticsAction(raw: unknown) {
  try {
    await requireUser();
    const input = BuildingInput.parse(raw);
    return { ok: true as const, analytics: await getBuildingChatAnalytics(input.buildingId, 30) };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

export async function loadFirmChatAnalyticsAction(raw: unknown) {
  try {
    await requireUser();
    const input = FirmInput.parse(raw);
    return { ok: true as const, analytics: await getFirmChatAnalytics(input.orgId, 30) };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

export async function loadPlatformChatAnalyticsAction() {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user, 'Only platform admins can view platform analytics');
    return { ok: true as const, analytics: await getPlatformChatAnalytics(30) };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
