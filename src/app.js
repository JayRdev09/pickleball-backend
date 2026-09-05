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

const corsConfig = config.cors.origin;
const corsOrigin = Array.isArray(corsConfig) ? corsConfig : [corsConfig];

app.use(cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));
app.options('*', cors({
    origin: corsOrigin,
    credentials: true,
}));

app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});

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

app.use('/api/auth', authRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/courts', courtsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/revenue', revenueRoutes);

app.use('*', (req, res) => {
    return sendError(res, `Route ${req.originalUrl} not found`, 404);
});

app.use(errorHandler);

const PORT = config.port || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Environment: ${config.nodeEnv}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;