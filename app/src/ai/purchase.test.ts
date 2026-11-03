import { describe, expect, it } from 'vitest';
import { confirmationFrom } from './purchase';

describe('confirmationFrom', () => {
  it('finishes a purchase only once its AI games are credited', () => {
    expect(confirmationFrom(200, { credited: true })).toEqual({ status: 'entitled', alreadyGranted: false });
    expect(confirmationFrom(200, { credited: false })).toEqual({ status: 'entitled', alreadyGranted: true });
  });
  it('waits on a pending payment, and settles purchases that are wrong', () => {
    expect(confirmationFrom(202, { pending: true })).toEqual({ status: 'store_pending' });
    expect(confirmationFrom(403, {})).toEqual({ status: 'ownership_conflict', alreadyGranted: false });
    expect(confirmationFrom(400, {})).toEqual({ status: 'invalid' });
  });
  it('leaves anything temporary for a later try', () => {
    for (const status of [401, 429, 500, 503]) expect(() => confirmationFrom(status, {})).toThrow();
  });
});
