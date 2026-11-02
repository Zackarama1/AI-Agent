import { createDemoApi } from './store';
import { seed } from './seed';
import type { Api } from '../api';
import type { Role } from '../types';

export function freshApi() {
  return createDemoApi(seed());
}

export async function signIn(api: Api, email: string, role: Role = 'student') {
  const { devCode } = await api.requestCode(email, role);
  return api.verifyCode(email, devCode!);
}
