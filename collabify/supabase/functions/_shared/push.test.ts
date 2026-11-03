import { pushMessages, tokensToForget } from './push.ts';

const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
};

Deno.test('one message per device, carrying the in-app link', () => {
  const msgs = pushMessages({ title: 'You’ve been paid £450', body: 'Done!', link: '/contract/1', kind: 'paid' }, ['t1', 't2']);
  eq(msgs.map((m) => m.to), ['t1', 't2'], 'recipients');
  eq(msgs[0].data, { link: '/contract/1', kind: 'paid' }, 'data');
});

Deno.test('only unregistered devices are forgotten', () => {
  const dead = tokensToForget(['a', 'b', 'c'], [
    { status: 'ok', id: '1' },
    { status: 'error', details: { error: 'DeviceNotRegistered' } },
    { status: 'error', details: { error: 'MessageRateExceeded' } },
  ]);
  eq(dead, ['b'], 'dead tokens');
});
