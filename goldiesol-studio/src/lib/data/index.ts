import 'server-only';
import { cache } from 'react';
import { isSupabaseConfigured } from '../env';
import { createSupabaseServerClient } from '../supabase/server';
import { demoRepository } from './demo';
import type { Repository } from './repository';
import { supabaseRepository } from './supabase';

export type { CollectionSummary, DesignDetail, DesignSummary, Repository } from './repository';

export const getRepository = cache(async (): Promise<Repository> =>
  isSupabaseConfigured() ? supabaseRepository(await createSupabaseServerClient()) : demoRepository,
);
