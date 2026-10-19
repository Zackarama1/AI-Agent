// Browser stand-in for src/lib/data: always the in-memory demo repository.
import { demoRepository } from '@/lib/data/demo';

export const getRepository = async () => demoRepository;
