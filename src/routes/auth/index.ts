import express from 'express';
import { AuthController } from '../../controllers/auth/users-controllers';
import { authenticateToken } from '../../middleware/auth-middleware';

const router = express.Router();

// ===== PUBLIC AUTHENTICATION ROUTES =====

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', AuthController.login);

/**
 * @route   POST /api/auth/google
 * @desc    Google OAuth authentication
 * @access  Public
 */
router.post('/google', AuthController.googleAuth);

/**
 * @route   GET /api/auth/google/initiate
 * @desc    Initiate Google OAuth flow
 * @access  Public
 */
router.get('/google/initiate', AuthController.googleInitiate);

/**
 * @route   GET /api/auth/google
 * @desc    Google OAuth callback
 * @access  Public
 */
router.get('/google', AuthController.googleCallback);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', AuthController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Public
 */
router.post('/logout', AuthController.logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @route   POST /api/auth/check-email
 * @desc    Check if email exists
 * @access  Public
 */
router.post('/check-email', AuthController.checkEmail);

// ===== PROTECTED AUTHENTICATION ROUTES =====

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/logout-all', authenticateToken, AuthController.logoutAll);

/**
 * @route   GET /api/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateToken, AuthController.getProfile);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateToken, AuthController.updateProfile);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/change-password', authenticateToken, AuthController.changePassword);

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify user email
 * @access  Private
 */
router.post('/verify-email', authenticateToken, AuthController.verifyEmail);

/**
 * @route   GET /api/auth/users/:id
 * @desc    Get user by ID (admin/protected route)
 * @access  Private
 */
router.get('/users/:id', authenticateToken, AuthController.getUserById);

// ===== HEALTH CHECK FOR AUTH MODULE =====

/**
 * @route   GET /api/auth/health
 * @desc    Health check for auth module
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auth module is healthy',
    timestamp: new Date().toISOString(),
    routes: {
      public: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/google',
        'POST /api/auth/refresh',
        'POST /api/auth/logout',
        'POST /api/auth/forgot-password',
        'POST /api/auth/check-email'
      ],
      protected: [
        'POST /api/auth/logout-all',
        'GET /api/auth/profile',
        'PUT /api/auth/profile',
        'POST /api/auth/change-password',
        'POST /api/auth/verify-email',
        'GET /api/auth/users/:id'
      ]
    }
  });
});

export default router;