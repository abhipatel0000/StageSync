const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const apiRoutes = require('./routes');
require('dotenv').config();

const app = express();

// Security headers with Helmet
app.use(helmet({
  crossOriginResourcePolicy: false // Allows serving local files if needed in dev
}));

// CORS Configuration
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim().replace(/\/$/, ''))
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl, mobile apps, or direct server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    const cleanOrigin = origin.trim().replace(/\/$/, '');
    if (corsOrigins.includes(cleanOrigin) || corsOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Token']
}));

// Request parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom lightweight cookie parser
app.use((req, res, next) => {
  req.cookies = {};
  const rawCookieHeader = req.headers.cookie;
  if (rawCookieHeader) {
    rawCookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      const name = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (name) {
        req.cookies[name] = decodeURIComponent(val);
      }
    });
  }
  next();
});

// HTTP Request Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Static files mapping for local uploads (only for fallback access control in development)
if (process.env.NODE_ENV !== 'production') {
  const uploadsDir = path.resolve(process.env.LOCAL_STORAGE_DIR || './uploads');
  app.use('/static-uploads', express.static(uploadsDir));
}

// API router mapping
app.use('/api/v1', apiRoutes);

// Base route ping
app.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'StageSync API is running.',
    timestamp: new Date()
  });
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'The requested API route does not exist.'
    }
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[Error Handler] Global caught exception:', err);

  // Multer limit error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'STORAGE_LIMIT_EXCEEDED',
        message: 'File size exceeds the maximum limit.'
      }
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected server error occurred.'
    }
  });
});

module.exports = app;
