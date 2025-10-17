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
router.post('/auth/register', AuthController.register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/auth/login', AuthController.login);

/**
 * @route   POST /api/auth/google
 * @desc    Google OAuth authentication
 * @access  Public
 */
router.post('/auth/google', AuthController.googleAuth);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/auth/refresh', AuthController.refreshToken);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (invalidate refresh token)
 * @access  Public
 */
router.post('/auth/logout', AuthController.logout);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/auth/forgot-password', AuthController.forgotPassword);

/**
 * @route   POST /api/auth/check-email
 * @desc    Check if email exists
 * @access  Public
 */
router.post('/auth/check-email', AuthController.checkEmail);

// ===== PROTECTED USER ROUTES =====

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/users/profile', authenticateToken, AuthController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/users/profile', authenticateToken, AuthController.updateProfile);

/**
 * @route   POST /api/users/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post('/users/change-password', authenticateToken, AuthController.changePassword);

/**
 * @route   POST /api/users/verify-email
 * @desc    Verify user email
 * @access  Private
 */
router.post('/users/verify-email', authenticateToken, AuthController.verifyEmail);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post('/auth/logout-all', authenticateToken, AuthController.logoutAll);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID (admin/protected route)
 * @access  Private
 */
router.get('/users/:id', authenticateToken, AuthController.getUserById);

// ===== HEALTH CHECK FOR USERS MODULE =====

/**
 * @route   GET /api/users/health
 * @desc    Health check for users module
 * @access  Public
 */
router.get('/users/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Users module is healthy',
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
        'GET /api/users/profile',
        'PUT /api/users/profile',
        'POST /api/users/change-password',
        'POST /api/users/verify-email',
        'POST /api/auth/logout-all',
        'GET /api/users/:id'
      ]
    }
  });
});

export default router;
