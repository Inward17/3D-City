/**
 * Demo mode: run the whole app with no login.
 *
 * The Supabase schema puts RLS on `projects`, `locations` and `roads` keyed to
 * `auth.uid()`, so simply skipping the /auth route would leave every query
 * returning nothing and every insert failing. Instead, when this flag is on the
 * stores read and write a localStorage-backed repository (see ./localRepo) and
 * never touch Supabase.
 *
 * Flip this to `false` to restore the real login flow. Nothing else needs to
 * change — routing, the project store and the city store all branch on it.
 */
export const DEMO_MODE = true;

/** Stand-in user id used for locally created projects while in demo mode. */
export const DEMO_USER_ID = 'demo-user';
