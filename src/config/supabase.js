const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

const supabase = createClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    }
);

const supabaseAdmin = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        }
    }
);

module.exports = {
    supabase,
    supabaseAdmin,
};