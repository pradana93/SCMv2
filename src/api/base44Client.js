// Compatibility shim: preserves the `base44` import surface used across the
// app (entities / auth / functions / integrations / users) while routing
// everything to Supabase + local services. No Base44 dependency remains.
import { entities } from './db';
import { authCompat, usersCompat } from './authCompat';
import { functionsCompat } from './functions/index';
import { integrationsCompat } from './storageCompat';

export const base44 = {
  entities,
  auth: authCompat,
  functions: functionsCompat,
  integrations: integrationsCompat,
  users: usersCompat,
};
