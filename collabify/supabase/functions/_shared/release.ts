import type { SupabaseClient } from '@supabase/supabase-js';
import { stripe } from './stripe.ts';

type ContractRow = {
  id: string; project_id: string; student_id: string; amount_pence: number; status: string; stripe_charge_id: string | null;
};

/**
 * Pay the student 100% of the project price from the held charge.
 * `source_transaction` ties the transfer to the charge so it works before funds settle;
 * the idempotency key makes retries (approve + auto-release racing) safe.
 */
export async function releaseContract(db: SupabaseClient, contract: ContractRow) {
  if (contract.status !== 'delivered') throw new Error(`Contract ${contract.id} is ${contract.status}, not delivered`);
  if (!contract.stripe_charge_id) throw new Error(`Contract ${contract.id} has no charge`);
  const { data: student } = await db.from('student_private').select('stripe_account_id, payouts_enabled').eq('id', contract.student_id).single();
  if (!student?.stripe_account_id || !student.payouts_enabled) throw new Error('The student has not finished payout setup yet');

  const transfer = await stripe<{ id: string }>('POST', '/transfers', {
    amount: contract.amount_pence,
    currency: 'gbp',
    destination: student.stripe_account_id,
    source_transaction: contract.stripe_charge_id,
    transfer_group: `contract_${contract.id}`,
    metadata: { contract_id: contract.id },
  }, `release-${contract.id}`);

  const { error } = await db.from('contracts')
    .update({ status: 'released', released_at: new Date().toISOString(), stripe_transfer_id: transfer.id })
    .eq('id', contract.id).eq('status', 'delivered');
  if (error) throw error;
  await db.from('projects').update({ status: 'completed' }).eq('id', contract.project_id);
  return transfer.id;
}
