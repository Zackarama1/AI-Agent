/**
 * What to do with a paid contract checkout that didn't move the contract to `funded`
 * (because it was no longer awaiting payment).
 */
export function afterUnexpectedPayment(
  contract: { status: string; stripe_payment_intent_id: string | null } | null,
  paymentIntentId: string,
): 'ignore' | 'refund' {
  if (!contract) return 'refund'; // contract gone: never keep money we can't attribute
  if (contract.stripe_payment_intent_id === paymentIntentId) return 'ignore'; // Stripe retried the same event
  if (contract.status === 'cancelled' || contract.stripe_payment_intent_id) return 'refund'; // cancelled, or paid twice
  return 'ignore';
}
