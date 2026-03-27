/** @jest-environment node */

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: () => Promise.resolve(body),
    }),
  },
}));

import { describe, it, expect } from '@jest/globals';
import { ok, fail, failWithDetails } from '@/lib/api-response';

describe('ok', () => {
  it('returns 200 with data and null error', async () => {
    const res = ok({ foo: 'bar' });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ data: { foo: 'bar' }, error: null });
  });
});

describe('fail', () => {
  it('returns given status with null data and error message', async () => {
    const res = fail('Something went wrong', 400);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ data: null, error: 'Something went wrong' });
  });
});

describe('failWithDetails', () => {
  it('returns given status with null data, error message, and errorDetails', async () => {
    const details = { cause: 'AUTHENTICATION', statusCode: 401 };
    const res = failWithDetails('CONNECTION_TEST_FAILED', details, 422);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json).toEqual({
      data: null,
      error: 'CONNECTION_TEST_FAILED',
      errorDetails: { cause: 'AUTHENTICATION', statusCode: 401 },
    });
  });

  it('returns errorDetails with nested objects', async () => {
    const details = { cause: 'UNKNOWN', providerMessage: 'Bad response: 403' };
    const res = failWithDetails('CONNECTION_TEST_FAILED', details, 422);
    const json = await res.json();
    expect(json.errorDetails.providerMessage).toBe('Bad response: 403');
  });
});
