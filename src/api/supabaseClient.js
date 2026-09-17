import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(url && anonKey);

function configError() {
  return new Error(
    'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY ' +
    '(Vercel: Project Settings > Environment Variables, then redeploy).'
  );
}

// Never throw at import time: a misconfigured deploy must render a setup
// message, not a blank page. The stub below throws a clear error only if
// Supabase is actually used without configuration.
function createStub() {
  const thrower = () => {
    throw configError();
  };
  const handler = {
    get(_target, prop) {
      if (prop === '__isStub') return true;
      // Allow `await supabase...` chains to fail gracefully-ish: any property
      // access returns a callable proxy that throws on invoke.
      return new Proxy(thrower, handler);
    },
    apply() {
      throw configError();
    },
  };
  return new Proxy({}, handler);
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createStub();

if (!isSupabaseConfigured) {
  console.error(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY is missing. ' +
    'Copy .env.example to .env.local locally; on Vercel set them in ' +
    'Project Settings > Environment Variables and redeploy.'
  );
}
