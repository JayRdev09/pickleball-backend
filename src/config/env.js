const dotenv = require('dotenv');
dotenv.config();

const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'JWT_SECRET'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// ✅ ADD YOUR VERCEL URL HERE
const getCorsOrigins = () => {
    if (process.env.CORS_ORIGIN) {
        return process.env.CORS_ORIGIN
            .split(',')
            .map(origin => origin.trim().replace(/\/$/, ''))
            .filter(origin => origin.length > 0);
    }
    
    // Default origins - ADD ALL YOUR FRONTEND URLs
    return [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:5173',
        'https://smartpickleball.netlify.app',  // Netlify deployment
        'https://smartpickle.vercel.app'       // 👈 ADD THIS - Vercel deployment
    ];
};

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    supabase: {
        url: process.env.SUPABASE_URL,
        anonKey: process.env.SUPABASE_ANON_KEY,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
    },
    cors: {
        origin: getCorsOrigins(),
    },
};
