const express = require('express')
const path = require('path')
const cors = require('cors')
const apiroute = require('./routes/apiroutes.js')
const errorHandle = require('./middleware/errorHandles.js')
const rateLimit = require('express-rate-limit')
const slowDownReq = require('express-slow-down')
const helmet =require('helmet')  //Security
const cookieparser = require('cookie-parser')
const authrouter = require('./routes/authroutes.js')
const adminrouter =require('./routes/ADMIN/index.js')
const reportrouter = require('./routes/reportroutes.js')
const reminderrouter = require('./routes/reminderroutes.js')
const voicedemorouter = require('./routes/voicedemoroutes.js')
const surveyrouter = require('./routes/surveyroutes.js')

// security: refuse to start unless farmer + admin jwt secrets are set and different, so tokens can't be swapped
if (!process.env.JWT_SECRET || !process.env.JWT_ADMIN_SECRET || process.env.JWT_SECRET === process.env.JWT_ADMIN_SECRET) {
    throw new Error('JWT_SECRET and JWT_ADMIN_SECRET must both be set and must be different')
}

// dev only: requests from this machine (the vite proxy, curl) skip the slowdown and the rate limit.
// exact match, not includes() - and in production every request comes from Caddy, so this stays off
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])
const isLocalDev = (req) => process.env.NODE_ENV !== 'production' && LOOPBACK.has(req.ip)


//Note to self:
//rewrite these when implementing nginx for load balancing
//otherwise every req would be blocked 
// reason : req.ip becomes the proxy ip
// and address potential vulns with the
// X-Forwarded-For header

// The limits are per IP, and Sri Lankan mobile networks put many phones behind one IP (CGNAT),
// so they have to allow a whole village opening the app at once during a flood.
// One portal screen is ~8-10 requests.
const WINDOW_MS = 5 * 60 * 1000
const SLOWDOWN_AFTER = 300
const RATE_LIMIT = 600

// SLOWDOWN after 300 requests: +250 ms per request over, never more than 2 s.
// The cap has to stay well under the portal's 15 s request timeout (farmerportal/src/api/auth.js),
// otherwise a slowed request reads as "Cannot reach the server" to the farmer.
const slowDown = slowDownReq({
    windowMs: WINDOW_MS,
    delayAfter: SLOWDOWN_AFTER,
    delayMs: (used) => (used - SLOWDOWN_AFTER) * 250,
    maxDelayMs: 2000,
    skip: isLocalDev
})


//IMplement Rate LImiting for API
const limiter = rateLimit({
    windowMs: WINDOW_MS,
    max: RATE_LIMIT,
    message: {error: 'Too many requests, please try again later.'},
    skip: isLocalDev
})

const app = express()

app.set('trust proxy', 1) // behind Caddy: req.ip is the client's IP from X-Forwarded-For

// Global Middleware
app.use(helmet())
app.use(cookieparser())
app.use(express.json( {limit: '10mb'}))
app.use(express.urlencoded( {extended: true, limit: '10mb'}))


const CREDENTIAL_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174')
    .split(',').map(origin => origin.trim()).filter(Boolean)

// security: only the listed origins get credentials (cookies), anyone else is plain public cors
app.use(cors((req, callback) => {
    const trusted = CREDENTIAL_ORIGINS.includes(req.header('Origin'))
    callback(null, {
        origin: trusted ? req.header('Origin') : '*',
        credentials: trusted,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
    })
}))

// admin portal loads a lot per page so it gets its own (higher) limit before the public slowdown.
// login lockout is separate, in ADMIN/authroutes.js
const adminLimiter = rateLimit({
    windowMs: 5*60*1000,
    max: 600,
    message: {error: 'Too many requests, please try again later.'}
})

app.use('/admin', adminLimiter, adminrouter)   // admin portal
// voice alert audio: public, Twilio fetches it while the call is ringing
// (cross-origin so the admin portal, on its own domain, can play it too)
app.use('/api/voice', express.static(path.join(__dirname, 'assets', 'voice'), {
  setHeaders: (res) => res.set('Cross-Origin-Resource-Policy', 'cross-origin')
}))

app.use(slowDown)
app.use(limiter)


// health & service discovery
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Yala Maha API Server',
        endpoints: {
            mahaweli: '/api/data/mahaweli',
            mahaweliJson: '/api/data/mahaweli?format=csv', 
            mahaweliCsv: '/api/data/mahaweli/csv',
            mahaweliById: '/api/data/mahaweli/:id',
            forecastByTankId: '/api/data/reservoir/:id/forecast',
            reservoir: '/api/data/reservoir',
            reservoirById: '/api/data/reservoir/:id',
            reservoirHistoryByDays: '/api/data/reservoir/:id/history?days=30',
            rivers: '/api/data/rivers',
            canals: '/api/data/canals',
            news: '/api/data/news?lang=en&district=Polonnaruwa',
            canalReports: '/api/reports (farmer sign-in)',
            waterReminders: '/api/reminders (farmer sign-in)'
        }
    })
})

// Convenience alias for /mahaweli-data
app.get(['/mahaweli-data', '/api/mahaweli-data'], (req, res) => {
    res.redirect(307, '/api/data/mahaweli?format=csv') 
})



app.use('/api/data', apiroute) // for resevoirs and tanks
app.use('/api/auth', authrouter)   //for l0gin auth
app.use('/api/reports', reportrouter)   // canal reports
app.use('/api/reminders', reminderrouter)   // water issue sms reminders
app.use('/api/surveys', surveyrouter)       // disaster & damage assessment surveys
app.use('/api/voice-demo', voicedemorouter)   // demo voice alert call to the team's own number

// Error handling middleware
app.use(errorHandle)

app.all('/*splat', (req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

module.exports = app
