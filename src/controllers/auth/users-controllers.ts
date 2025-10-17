import { Request, Response } from 'express';
import { AuthService } from '../../services/users-services';
import { CreateUserData, GoogleUserData, UpdateUserData } from '../../util/types/users-types';

// Helper function to get user IP address
const getClientIP = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress || 
         'unknown';
};

// Helper function to get user agent
const getUserAgent = (req: Request): string => {
  return req.headers['user-agent'] || 'unknown';
};

export class AuthController {
  
  // ===== AUTHENTICATION =====

  /**
   * Register new user
   * POST /api/auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const userData: CreateUserData = req.body;
      
      // Validate required fields
      if (!userData.email || !userData.password ) {
        res.status(400).json({
          success: false,
          message: 'Email, password, and first name are required',
          errors: [{
            code: 'MISSING_REQUIRED_FIELDS',
            message: 'Email, password, and first name are required'
          }]
        });
        return;
      }
      if(userData.password.length < 8 ){
        res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long',
          errors: [{
            code: 'WEAK_PASSWORD',
            message: 'Password must be at least 8 characters long'
          }]
        });
        return;
      }

      const result = await AuthService.register(userData);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Registration failed',
          errors: result.errors
        });
        return;
      }

      // Set tokens in HTTP-only cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 15 // 15 minutes
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      });
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: result.user
        }
      });

    } catch (error) {
      console.error('Registration controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
          errors: [{
            code: 'MISSING_CREDENTIALS',
            message: 'Email and password are required'
          }]
        });
        return;
      }

      const userAgent = getUserAgent(req);
      const ipAddress = getClientIP(req);

      const result = await AuthService.login(email, password, userAgent, ipAddress);

      if (!result.success) {
        res.status(401).json({
          success: false,
          message: 'Login failed',
          errors: result.errors
        });
        return;
      }

      // Set tokens in HTTP-only cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 15 // 15 minutes
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      });
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user
        }
      });

    } catch (error) {
      console.error('Login controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Google OAuth login
   * POST /api/auth/google
   */
  static async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      const googleData: GoogleUserData = req.body;

      // Validate required Google data
      if (!googleData.googleId || !googleData.email || !googleData.firstName) {
        res.status(400).json({
          success: false,
          message: 'Google ID, email, and first name are required',
          errors: [{
            code: 'MISSING_GOOGLE_DATA',
            message: 'Google ID, email, and first name are required'
          }]
        });
        return;
      }

      const userAgent = getUserAgent(req);
      const ipAddress = getClientIP(req);

      const result = await AuthService.googleAuth(googleData, userAgent, ipAddress);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Google authentication failed',
          errors: result.errors
        });
        return;
      }

      // Set tokens in HTTP-only cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 15 // 15 minutes
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      });
      res.status(200).json({
        success: true,
        message: result.isNewUser ? 'Account created successfully' : 'Login successful',
        data: {
          user: result.user,
          isNewUser: result.isNewUser
        }
      });

    } catch (error) {
      console.error('Google auth controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Google OAuth initiate
   * GET /api/auth/google/initiate
   */
  static async googleInitiate(req: Request, res: Response): Promise<void> {
    try {
      const googleClientId = process.env.GOOGLE_CLIENT_ID;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:4000'}/api/auth/google`;
      
      if (!googleClientId) {
        res.status(500).json({
          success: false,
          message: 'Google OAuth not configured',
          errors: [{
            code: 'OAUTH_CONFIG_ERROR',
            message: 'Google Client ID is not configured'
          }]
        });
        return;
      }

      // Create Google OAuth URL
      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      googleAuthUrl.searchParams.set('client_id', googleClientId);
      googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
      googleAuthUrl.searchParams.set('response_type', 'code');
      googleAuthUrl.searchParams.set('scope', 'openid email profile');
      googleAuthUrl.searchParams.set('access_type', 'offline');
      googleAuthUrl.searchParams.set('prompt', 'consent');

      console.log('Redirecting to Google OAuth:', googleAuthUrl.toString());
      res.redirect(googleAuthUrl.toString());

    } catch (error) {
      console.error('Google OAuth initiate error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate Google OAuth',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Google OAuth callback
   * GET /api/auth/google
   */
  static async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      console.log('Google OAuth callback received');
      console.log('Query params:', req.query);
      
      const code = req.query.code as string;
      const error = req.query.error as string;
      
      if (error) {
        console.error('OAuth error from Google:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/login?error=oauth_error&details=${encodeURIComponent(error)}`);
        return;
      }
      
      if (!code) {
        console.error('No authorization code received');
        res.status(400).json({
          success: false,
          message: 'Missing authorization code',
          errors: [{
            code: 'MISSING_CODE',
            message: 'Authorization code is required'
          }]
        });
        return;
      }

      // Import axios for HTTP requests
      const axios = require('axios');

      // Exchange authorization code for access token
      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', 
        new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:4000'}/api/auth/google`,
          grant_type: 'authorization_code',
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token } = tokenRes.data;

      // Fetch user info from Google
      const userRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const googleUser = userRes.data;

      // Prepare user data for authentication
      const googleData: GoogleUserData = {
        googleId: googleUser.sub,
        email: googleUser.email,
        firstName: googleUser.given_name,
        lastName: googleUser.family_name,
      };

      const userAgent = getUserAgent(req);
      const ipAddress = getClientIP(req);

      // Authenticate user with our system
      const result = await AuthService.googleAuth(googleData, userAgent, ipAddress);

      if (!result.success) {
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/login?error=auth_failed`);
        return;
      }

      // Set tokens in HTTP-only cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-site redirects
        maxAge: 1000 * 60 * 15 // 15 minutes
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-site redirects
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      });

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const redirectUrl = `${frontendUrl}/?login_success=true&new_user=${result.isNewUser}`;
      res.redirect(redirectUrl);

    } catch (error) {
      console.error('Google OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/login?error=callback_failed`);
    }
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          errors: [{
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required'
          }]
        });
        return;
      }

      const result = await AuthService.refreshToken(refreshToken);

      if (!result.success) {
        res.status(401).json({
          success: false,
          message: 'Token refresh failed',
          errors: result.errors
        });
        return;
      }

      // Set tokens in HTTP-only cookies
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 15 // 15 minutes
      });
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
      });
      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      console.error('Refresh token controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          errors: [{
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required'
          }]
        });
        return;
      }

      const result = await AuthService.logout(refreshToken);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Logout failed',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });

    } catch (error) {
      console.error('Logout controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Logout from all devices
   * POST /api/auth/logout-all
   */
  static async logoutAll(req: Request, res: Response): Promise<void> {
    try {
      // This requires authentication middleware to set req.user
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Please login to access this resource'
          }]
        });
        return;
      }

      const result = await AuthService.logoutAll(userId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Logout from all devices failed',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully',
        data: {
          loggedOutDevices: result.loggedOutDevices
        }
      });

    } catch (error) {
      console.error('Logout all controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // ===== USER PROFILE =====

  /**
   * Get current user profile
   * GET /api/users/profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Please login to access this resource'
          }]
        });
        return;
      }

      const result = await AuthService.getProfile(userId);

      if (!result.success) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: result.user
        }
      });

    } catch (error) {
      console.error('Get profile controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Update user profile
   * PUT /api/users/profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const updateData: UpdateUserData = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Please login to access this resource'
          }]
        });
        return;
      }

      const result = await AuthService.updateProfile(userId, updateData);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Profile update failed',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: result.user
        }
      });

    } catch (error) {
      console.error('Update profile controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // ===== PASSWORD MANAGEMENT =====

  /**
   * Change password
   * POST /api/users/change-password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Please login to access this resource'
          }]
        });
        return;
      }

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Current password and new password are required',
          errors: [{
            code: 'MISSING_PASSWORDS',
            message: 'Current password and new password are required'
          }]
        });
        return;
      }

      const result = await AuthService.changePassword(userId, currentPassword, newPassword);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Password change failed',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });

    } catch (error) {
      console.error('Change password controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Forgot password
   * POST /api/auth/forgot-password
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required',
          errors: [{
            code: 'MISSING_EMAIL',
            message: 'Email is required'
          }]
        });
        return;
      }

      await AuthService.forgotPassword(email);

      // Always return success for security (don't reveal if email exists)
      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });

    } catch (error) {
      console.error('Forgot password controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // ===== EMAIL VERIFICATION =====

  /**
   * Verify email
   * POST /api/users/verify-email
   */
  static async verifyEmail(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          errors: [{
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Please login to access this resource'
          }]
        });
        return;
      }

      const result = await AuthService.verifyEmail(userId);

      if (!result.success) {
        res.status(400).json({
          success: false,
          message: 'Email verification failed',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Email verified successfully'
      });

    } catch (error) {
      console.error('Verify email controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  // ===== UTILITY ENDPOINTS =====

  /**
   * Check if email exists
   * POST /api/auth/check-email
   */
  static async checkEmail(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({
          success: false,
          message: 'Email is required',
          errors: [{
            code: 'MISSING_EMAIL',
            message: 'Email is required'
          }]
        });
        return;
      }

      const result = await AuthService.checkEmailExists(email);

      if (result.errors) {
        res.status(400).json({
          success: false,
          message: 'Email check failed',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Email check completed',
        data: {
          exists: result.exists
        }
      });

    } catch (error) {
      console.error('Check email controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }

  /**
   * Get user by ID (admin/protected route)
   * GET /api/users/:id
   */
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'User ID is required',
          errors: [{
            code: 'MISSING_USER_ID',
            message: 'User ID is required'
          }]
        });
        return;
      }

      const result = await AuthService.getUserById(id);

      if (!result.success) {
        res.status(404).json({
          success: false,
          message: 'User not found',
          errors: result.errors
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'User retrieved successfully',
        data: {
          user: result.user
        }
      });

    } catch (error) {
      console.error('Get user by ID controller error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  }
}
