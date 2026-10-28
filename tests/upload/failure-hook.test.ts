// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { handleIngestFailure } from '@/inngest/ingest';

const DOC_ID = '93000000-0000-4000-8000-00000000000b';
const BUILDING_ID = '93000000-0000-4000-8000-00000000000a';
const ACTOR_ID = '93000000-0000-4000-8000-000000000001';

const eventPayload = {
  documentId: DOC_ID,
  buildingId: BUILDING_ID,
  actorId: ACTOR_ID,
};

describe('handleIngestFailure', () => {
  let docState: { status: string; error_message: string | null };
  let updateCalls: Array<{ status: string; error_message: string }>;

  const mockDb = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { status: docState.status, error_message: docState.error_message },
            error: null,
          }),
        }),
      }),
      update: (payload: { status: string; error_message: string }) => {
        updateCalls.push(payload);
        return {
          eq: () => ({
            is: () => Promise.resolve({ error: null }),
          }),
        };
      },
    }),
  } as unknown as Parameters<typeof handleIngestFailure>[2];

  beforeEach(() => {
    docState = { status: 'scanning', error_message: null };
    updateCalls = [];
  });

  it('preserves an existing specific error message and does not overwrite it', async () => {
    docState = {
      status: 'failed',
      error_message: 'This file did not pass the malware scan.',
    };

    const res = await handleIngestFailure(
      eventPayload,
      new Error('NonRetriableError: This file did not pass the malware scan.'),
      mockDb,
    );

    expect(res.updated).toBe(false);
    expect(res.message).toBe('This file did not pass the malware scan.');
    expect(updateCalls).toHaveLength(0);
  });

  it('sanitizes unexpected database errors rather than showing raw system strings to users', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const res = await handleIngestFailure(
      eventPayload,
      new Error('PostgresError: column documents.updated_at does not exist at pg_client.ts:42'),
      mockDb,
    );

    expect(res.updated).toBe(true);
    expect(res.message).toBe('Indexing could not complete. Retry the upload or contact your administrator.');
    expect(updateCalls).toEqual([
      {
        status: 'failed',
        error_message: 'Indexing could not complete. Retry the upload or contact your administrator.',
      },
    ]);
  });

  it('sanitizes raw network and socket exceptions', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const res = await handleIngestFailure(eventPayload, new Error('fetch failed: ECONNRESET'), mockDb);

    expect(res.updated).toBe(true);
    expect(res.message).toBe('Indexing could not complete. Retry the upload or contact your administrator.');
  });

  it('sanitizes unexpected errors like Failed to parse input that are not in the allowlist', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const res = await handleIngestFailure(eventPayload, new Error('Failed to parse input'), mockDb);

    expect(res.updated).toBe(true);
    expect(res.message).toBe('Indexing could not complete. Retry the upload or contact your administrator.');
  });

  it('sanitizes internal Document ingestion failed messages to avoid leaking UUIDs', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const res = await handleIngestFailure(
      eventPayload,
      new Error(`Document ingestion failed: ${DOC_ID}`),
      mockDb,
    );

    expect(res.updated).toBe(true);
    expect(res.message).toBe('Indexing could not complete. Retry the upload or contact your administrator.');
    expect(res.message).not.toContain(DOC_ID);
    expect(updateCalls[0].error_message).toBe(
      'Indexing could not complete. Retry the upload or contact your administrator.',
    );
  });

  it('preserves an in-flight scanner failure message recorded while scanning and marks status failed', async () => {
    docState = {
      status: 'scanning',
      error_message: 'The malware scanner did not respond. Try again later.',
    };

    const res = await handleIngestFailure(
      eventPayload,
      new Error('InngestExecutionError: step failed after 3 retries'),
      mockDb,
    );

    expect(res.updated).toBe(true);
    expect(res.message).toBe('The malware scanner did not respond. Try again later.');
    expect(updateCalls).toEqual([
      {
        status: 'failed',
      },
    ]);
  });

  it('unpacks nested error.cause.message when error wraps a valid user explanation', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const nestedError = {
      name: 'InngestError',
      cause: { message: 'The malware scanner returned an unreadable result. Try again later.' },
    };

    const res = await handleIngestFailure(eventPayload, nestedError, mockDb);

    expect(res.updated).toBe(true);
    expect(res.message).toBe('The malware scanner returned an unreadable result. Try again later.');
  });

  it('provides a general fallback when error has no message', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const res = await handleIngestFailure(eventPayload, {}, mockDb);

    expect(res.updated).toBe(true);
    expect(res.message).toBe('Indexing could not complete. Retry the upload or contact your administrator.');
  });
});
