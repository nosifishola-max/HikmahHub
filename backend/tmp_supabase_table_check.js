const fs = require('fs');

function parseEnvFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

(async () => {
  try {
    const env = parseEnvFile(require('path').join(__dirname, '.env'));

    const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      console.error('Missing VITE_SUPABASE_URL (from backend/.env).');
      process.exitCode = 1;
      return;
    }
    if (!supabaseAnonKey) {
      console.error('Missing VITE_SUPABASE_ANON_KEY (from backend/.env).');
      process.exitCode = 1;
      return;
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.from('users').select('id').limit(1);

    if (error) {
      console.log('ERROR');
      console.log(JSON.stringify(error, null, 2));
      process.exitCode = 2;
      return;
    }

    console.log('OK');
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('UNEXPECTED_ERROR');
    console.error(e);
    process.exitCode = 99;
  }
})();
