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

  it('transitions a scanning document to failed on retry exhaustion with a clear message', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const res = await handleIngestFailure(
      eventPayload,
      new Error('Scanner service connection refused'),
      mockDb,
    );

    expect(res.updated).toBe(true);
    expect(res.message).toBe('Scanner service connection refused');
    expect(updateCalls).toEqual([{ status: 'failed', error_message: 'Scanner service connection refused' }]);
  });

  it('handles wrapped Inngest failure event shapes seamlessly', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const wrappedEvent = {
      event: {
        data: eventPayload,
      },
    };

    const res = await handleIngestFailure(wrappedEvent, new Error('Network timeout'), mockDb);

    expect(res.updated).toBe(true);
    expect(res.message).toBe('Network timeout');
    expect(updateCalls).toHaveLength(1);
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

  it('unpacks nested error.cause.message when error wraps the real cause', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const nestedError = {
      name: 'InngestError',
      cause: { message: 'PDF font encoding unsupported' },
    };

    const res = await handleIngestFailure(eventPayload, nestedError, mockDb);

    expect(res.updated).toBe(true);
    expect(res.message).toBe('PDF font encoding unsupported');
  });

  it('provides a general fallback when error has no message', async () => {
    docState = {
      status: 'scanning',
      error_message: null,
    };

    const res = await handleIngestFailure(eventPayload, {}, mockDb);

    expect(res.updated).toBe(true);
    expect(res.message).toBe(
      'Indexing could not complete after multiple retry attempts. You can retry the upload.',
    );
  });
});
