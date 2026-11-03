export type PushTicket = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };

/** One Expo push message per device for a notification row. */
export function pushMessages(n: { title: string; body: string; link: string; kind: string }, tokens: string[]) {
  return tokens.map((to) => ({
    to,
    title: n.title,
    body: n.body,
    sound: 'default',
    data: { link: n.link, kind: n.kind },
  }));
}

/** Tokens Expo says no longer exist (app deleted, permission revoked): stop sending to them. */
export function tokensToForget(tokens: string[], tickets: PushTicket[]) {
  return tokens.filter((_, i) => tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered');
}
