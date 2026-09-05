require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const { sendSuccess, sendError } = require('./utils/response');
const { supabase } = require('./config/supabase');

const authRoutes = require('./modules/auth/auth.routes');
const playerRoutes = require('./modules/players/players.routes');
const bookingRoutes = require('./modules/bookings/bookings.routes');
const sessionRoutes = require('./modules/sessions/sessions.routes');
const courtsRoutes = require('./modules/courts/courts.routes');
const templatesRoutes = require('./modules/templates/templates.routes');
const queueRoutes = require('./modules/queue/queue.routes');
const revenueRoutes = require('./modules/revenue/revenue.routes');

const app = express();

// 👇 DEBUGGING - Log the CORS config
console.log('📋 CORS Configuration:', {
    origins: config.cors.origin,
    environment: config.nodeEnv
});

// ✅ CORS Setup
const corsConfig = config.cors.origin;
const corsOrigin = Array.isArray(corsConfig) ? corsConfig : [corsConfig];

// Dynamic CORS - allows specific origins or any in development
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed list
        if (corsOrigin.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ CORS blocked for origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

// Handle preflight requests explicitly
app.options('*', cors());

// Security headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('dev'));

// Request logger
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true })
            .single();
        
        if (error) {
            return sendError(res, `Database connection failed: ${error.message}`, 503);
        }
        
        return sendSuccess(res, {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: config.nodeEnv,
            database: 'connected',
        });
    } catch (error) {
        return sendError(res, 'Health check failed', 503);
    }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/courts', courtsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/revenue', revenueRoutes);

// Root endpoint (optional - helpful for testing)
app.get('/', (req, res) => {
    res.json({
        message: 'Pickleball Backend API',
        version: '1.0.0',
        status: 'running',
        environment: config.nodeEnv,
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            players: '/api/players',
            bookings: '/api/bookings',
            sessions: '/api/sessions',
            courts: '/api/courts',
            templates: '/api/templates',
            queue: '/api/queue',
            revenue: '/api/revenue'
        }
    });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    return sendError(res, `Route ${req.originalUrl} not found`, 404);
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
    console.log(`✅ CORS enabled for: ${corsOrigin.join(', ')}`);
});

module.exports = app;