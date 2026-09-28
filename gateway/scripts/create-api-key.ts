import { randomBytes, createHash } from 'node:crypto';
import { supabaseAdmin } from '../src/supabase/client.js';
import { API_KEY_PREFIX } from '../src/auth/apiKey.js';

const [, , userId, nameArg] = process.argv;

if (!userId) {
  console.error('usage: npm run create-key -- <user_id> [name]');
  process.exit(1);
}

const raw = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
const prefix = raw.slice(0, 12);
const key_hash = createHash('sha256').update(raw).digest('hex');

const { error } = await supabaseAdmin.from('api_keys').insert({
  user_id: userId,
  name: nameArg ?? 'default',
  prefix,
  key_hash,
  scopes: ['user'],
});

if (error) {
  console.error('insert failed:', error.message);
  process.exit(1);
}

console.log('API key (shown once, store it now):');
console.log(raw);
