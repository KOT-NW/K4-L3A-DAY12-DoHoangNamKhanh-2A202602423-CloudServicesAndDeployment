import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

/**
 * Service-role client. NEVER expose this to the browser / React app.
 * The gateway is the only component allowed to hold this key.
 */
export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
