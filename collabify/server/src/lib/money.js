/**
 * Split a project amount into platform commission and student payout.
 * All amounts are integer pence to avoid floating point drift.
 */
export function splitPayment(amountPence, commissionRate) {
  if (!Number.isInteger(amountPence) || amountPence <= 0) throw new Error('amountPence must be a positive integer');
  if (!(commissionRate >= 0 && commissionRate < 1)) throw new Error('commissionRate must be in [0, 1)');
  const commissionPence = Math.round(amountPence * commissionRate);
  return { amountPence, commissionPence, payoutPence: amountPence - commissionPence };
}

export const formatGBP = (pence) => `£${(pence / 100).toFixed(2)}`;
