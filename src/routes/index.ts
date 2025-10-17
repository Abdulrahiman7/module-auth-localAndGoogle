import express from 'express';
import authRoutes from './auth';

const router = express.Router();

// Mount auth routes
router.use('/auth', authRoutes);

// Health check for the entire API
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API routes are healthy',
    timestamp: new Date().toISOString(),
    availableRoutes: {
      auth: '/api/auth/*',
      health: '/api/health'
    }
  });
});

// API info endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to White Yards Real Estate API',
    version: '1.0.0',
    documentation: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        googleAuth: 'POST /api/auth/google',
        refreshToken: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        logoutAll: 'POST /api/auth/logout-all',
        forgotPassword: 'POST /api/auth/forgot-password',
        checkEmail: 'POST /api/auth/check-email'
      },
      users: {
        profile: 'GET /api/auth/profile',
        updateProfile: 'PUT /api/auth/profile',
        changePassword: 'POST /api/auth/change-password',
        verifyEmail: 'POST /api/auth/verify-email',
        getUserById: 'GET /api/auth/users/:id'
      },
      health: 'GET /api/health'
    }
  });
});

export default router;