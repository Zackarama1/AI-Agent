import crypto from 'node:crypto';

/**
 * Mock escrow provider: money movement is simulated and recorded only in the internal ledger.
 * Used in development, demos and tests. Funding succeeds immediately.
 */
export const mockProvider = {
  name: 'mock',
  async fund({ contract }) {
    return { ref: `mock_pi_${contract.id}_${crypto.randomBytes(4).toString('hex')}`, funded: true };
  },
  async release() {
    return { ref: `mock_tr_${crypto.randomBytes(4).toString('hex')}` };
  },
  async refund() {
    return { ref: `mock_re_${crypto.randomBytes(4).toString('hex')}` };
  },
};
