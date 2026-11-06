import { describe, expect, it } from 'vitest';
import { confirmationFrom, purchaseErrorMessage } from './purchase';

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

describe('purchaseErrorMessage', () => {
  it('says nothing when the host cancels', () => {
    expect(purchaseErrorMessage({ code: 'user-cancelled', message: 'User cancelled' })).toBeNull();
  });
  it("never shows the library's own text, and says the host wasn't charged", () => {
    const declined = purchaseErrorMessage({ code: 'billing-unavailable', message: 'Billing API version is not supported' })!;
    expect(declined).not.toContain('Billing API');
    expect(declined).toContain("weren't charged");
    expect(purchaseErrorMessage(new Error('boom'))).toContain("weren't charged");
    expect(purchaseErrorMessage(null)).toContain("weren't charged");
  });
  it('explains being offline, a pending payment and an unavailable pack', () => {
    expect(purchaseErrorMessage({ code: 'network-error' })).toContain('online');
    expect(purchaseErrorMessage({ code: 'deferred-payment' })).toContain('pending');
    expect(purchaseErrorMessage({ code: 'item-unavailable' })).toContain("isn't available");
  });
});
