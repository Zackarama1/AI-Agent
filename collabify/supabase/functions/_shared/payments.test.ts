import { afterUnexpectedPayment } from './payments.ts';

const eq = (a: unknown, b: unknown, m: string) => { if (a !== b) throw new Error(`${m}: ${a} !== ${b}`); };

Deno.test('a retried webhook for the same payment is ignored, never refunded', () => {
  eq(afterUnexpectedPayment({ status: 'funded', stripe_payment_intent_id: 'pi_1' }, 'pi_1'), 'ignore', 'duplicate');
  eq(afterUnexpectedPayment({ status: 'released', stripe_payment_intent_id: 'pi_1' }, 'pi_1'), 'ignore', 'duplicate after release');
});

Deno.test('payments for cancelled hires or double payments are refunded', () => {
  eq(afterUnexpectedPayment({ status: 'cancelled', stripe_payment_intent_id: null }, 'pi_2'), 'refund', 'cancelled');
  eq(afterUnexpectedPayment({ status: 'funded', stripe_payment_intent_id: 'pi_1' }, 'pi_2'), 'refund', 'second checkout');
  eq(afterUnexpectedPayment(null, 'pi_3'), 'refund', 'missing contract');
});
