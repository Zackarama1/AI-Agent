// Supabase is optional: without it the studio runs in demo mode on seed data.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);
