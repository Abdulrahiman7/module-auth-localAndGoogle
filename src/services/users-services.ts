import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { UsersRepository } from '../repository/users-repository';
import {
  User,
  CreateUserData,
  UpdateUserData,
  GoogleUserData,
  UserTokenData,
  LoginResult,
  UserProfile,
  UserError,
  ValidationResult
} from '../util/types/users-types';

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'; // 7 days

// Ensure JWT_SECRET is not empty
if (!JWT_SECRET || JWT_SECRET === 'your-super-secret-jwt-key') {
  console.warn('⚠️  Using default JWT secret. Please set JWT_SECRET environment variable for production!');
}

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/; // Indian mobile number format

export class AuthService {

  // ===== AUTHENTICATION CORE METHODS =====

  /**
   * Generate JWT access token
   */
  private static generateAccessToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      provider: user.provider,
    };

    const options = {
      expiresIn: JWT_EXPIRES_IN as any,
      issuer: 'whiteyards-api',
      audience: 'whiteyards-client',
    };

    return jwt.sign(payload, JWT_SECRET, options);
  }

  /**
   * Generate refresh token
   */
  private static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Verify JWT token
   */
  static verifyAccessToken(token: string): { userId: string; email: string; role: string; provider: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'whiteyards-api',
        audience: 'whiteyards-client',
      }) as { userId: string; email: string; role: string; provider: string };

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        provider: decoded.provider,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Validate user input data
   */
  private static validateUserData(userData: Partial<CreateUserData>): ValidationResult {
    const errors: UserError[] = [];

    // Email validation
    if (userData.email && !EMAIL_REGEX.test(userData.email)) {
      errors.push({
        code: 'INVALID_EMAIL',
        message: 'Please provide a valid email address',
        field: 'email'
      });
    }

    // Password validation for local users
    if (userData.password && userData.provider === 'local') {
      if (!PASSWORD_REGEX.test(userData.password)) {
        errors.push({
          code: 'WEAK_PASSWORD',
          message: 'Password must be at least 8 characters with uppercase, lowercase, number and special character',
          field: 'password'
        });
      }
    }

    // Mobile validation (optional)
    if (userData.mobile && !MOBILE_REGEX.test(userData.mobile)) {
      errors.push({
        code: 'INVALID_MOBILE',
        message: 'Please provide a valid 10-digit Indian mobile number',
        field: 'mobile'
      });
    }

    // Name validation
    if (userData.firstName && userData.firstName.length < 2) {
      errors.push({
        code: 'INVALID_FIRSTNAME',
        message: 'First name must be at least 2 characters',
        field: 'firstName'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // ===== USER REGISTRATION =====

  /**
   * Register new user (local)
   */
  static async register(userData: CreateUserData): Promise<{
    success: boolean;
    user?: Omit<User, 'passwordHash'>;
    accessToken?: string;
    refreshToken?: string;
    errors?: UserError[];
  }> {
    try {
      // Validate input data
      const validation = this.validateUserData(userData);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      // Check if user already exists
      const existingUser = await UsersRepository.findByEmail(userData.email);
      if (existingUser) {
        return {
          success: false,
          errors: [{
            code: 'EMAIL_EXISTS',
            message: 'An account with this email already exists',
            field: 'email'
          }]
        };
      }

      // Create new user
      const newUser = await UsersRepository.createUser({
        ...userData,
        provider: 'local',
        emailVerified: false,
      });

      // Generate tokens
      const accessToken = this.generateAccessToken(newUser as User);
      const refreshToken = this.generateRefreshToken();

      // Store refresh token
      await UsersRepository.createRefreshToken({
        userId: newUser.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return {
        success: true,
        user: newUser,
        accessToken,
        refreshToken,
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        errors: [{
          code: 'REGISTRATION_FAILED',
          message: 'Registration failed. Please try again.',
        }]
      };
    }
  }

  // ===== USER LOGIN =====

  /**
   * Login user (local)
   */
  static async login(email: string, password: string, userAgent?: string, ipAddress?: string): Promise<{
    success: boolean;
    user?: Omit<User, 'passwordHash'>;
    accessToken?: string;
    refreshToken?: string;
    errors?: UserError[];
  }> {
    try {
      // Validate credentials
      const user = await UsersRepository.verifyPassword(email, password);
      if (!user) {
        return {
          success: false,
          errors: [{
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          }]
        };
      }

      // Check if account is active
      if (user.role === 'suspended') {
        return {
          success: false,
          errors: [{
            code: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended. Please contact support.',
          }]
        };
      }

      // Generate tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken();

      // Store refresh token
      await UsersRepository.createRefreshToken({
        userId: user.id,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // Remove sensitive data
      const { passwordHash, ...safeUser } = user;

      return {
        success: true,
        user: safeUser,
        accessToken,
        refreshToken,
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        errors: [{
          code: 'LOGIN_FAILED',
          message: 'Login failed. Please try again.',
        }]
      };
    }
  }

  // ===== GOOGLE OAUTH =====

  /**
   * Handle Google OAuth login/registration
   */
  static async googleAuth(googleData: GoogleUserData, userAgent?: string, ipAddress?: string): Promise<{
    success: boolean;
    user?: Omit<User, 'passwordHash'>;
    accessToken?: string;
    refreshToken?: string;
    isNewUser?: boolean;
    errors?: UserError[];
  }> {
    try {
      // Check if user exists
      const existingUser = await UsersRepository.findByEmailOrGoogleId(googleData.email, googleData.googleId);
      const isNewUser = !existingUser;

      // Create or update user
      const user = await UsersRepository.createOrUpdateGoogleUser(googleData);

      // Generate tokens
      const accessToken = this.generateAccessToken(user as User);
      const refreshToken = this.generateRefreshToken();

      // Store refresh token
      await UsersRepository.createRefreshToken({
        userId: user.id,
        refreshToken,
        userAgent,
        ipAddress,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return {
        success: true,
        user,
        accessToken,
        refreshToken,
        isNewUser,
      };

    } catch (error) {
      console.error('Google auth error:', error);
      return {
        success: false,
        errors: [{
          code: 'GOOGLE_AUTH_FAILED',
          message: 'Google authentication failed. Please try again.',
        }]
      };
    }
  }

  // ===== TOKEN MANAGEMENT =====

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    errors?: UserError[];
  }> {
    try {
      // Find valid refresh token
      const tokenData = await UsersRepository.findValidRefreshToken(refreshToken);
      if (!tokenData) {
        return {
          success: false,
          errors: [{
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Invalid or expired refresh token',
          }]
        };
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(tokenData.user);
      const newRefreshToken = this.generateRefreshToken();

      // Delete old refresh token
      await UsersRepository.deleteRefreshToken(refreshToken);

      // Store new refresh token
      await UsersRepository.createRefreshToken({
        userId: tokenData.user.id,
        refreshToken: newRefreshToken,
        userAgent: tokenData.userAgent || undefined,
        ipAddress: tokenData.ipAddress || undefined,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return {
        success: true,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };

    } catch (error) {
      console.error('Token refresh error:', error);
      return {
        success: false,
        errors: [{
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Failed to refresh token. Please login again.',
        }]
      };
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  static async logout(refreshToken: string): Promise<{
    success: boolean;
    errors?: UserError[];
  }> {
    try {
      const deleted = await UsersRepository.deleteRefreshToken(refreshToken);
      
      return {
        success: deleted,
        errors: deleted ? undefined : [{
          code: 'LOGOUT_FAILED',
          message: 'Logout failed',
        }]
      };

    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        errors: [{
          code: 'LOGOUT_FAILED',
          message: 'Logout failed',
        }]
      };
    }
  }

  /**
   * Logout from all devices
   */
  static async logoutAll(userId: string): Promise<{
    success: boolean;
    loggedOutDevices?: number;
    errors?: UserError[];
  }> {
    try {
      const loggedOutDevices = await UsersRepository.deleteAllUserRefreshTokens(userId);
      
      return {
        success: true,
        loggedOutDevices,
      };

    } catch (error) {
      console.error('Logout all error:', error);
      return {
        success: false,
        errors: [{
          code: 'LOGOUT_ALL_FAILED',
          message: 'Failed to logout from all devices',
        }]
      };
    }
  }

  // ===== USER PROFILE MANAGEMENT =====

  /**
   * Get current user profile
   */
  static async getProfile(userId: string): Promise<{
    success: boolean;
    user?: Omit<User, 'passwordHash'>;
    errors?: UserError[];
  }> {
    try {
      const user = await UsersRepository.getUserProfile(userId);
      
      if (!user) {
        return {
          success: false,
          errors: [{
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          }]
        };
      }

      return {
        success: true,
        user,
      };

    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        errors: [{
          code: 'PROFILE_FETCH_FAILED',
          message: 'Failed to fetch profile',
        }]
      };
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updateData: UpdateUserData): Promise<{
    success: boolean;
    user?: Omit<User, 'passwordHash'>;
    errors?: UserError[];
  }> {
    try {
      // Validate update data
      const validation = this.validateUserData(updateData);
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      const updatedUser = await UsersRepository.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return {
          success: false,
          errors: [{
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          }]
        };
      }

      return {
        success: true,
        user: updatedUser,
      };

    } catch (error) {
      console.error('Update profile error:', error);
      return {
        success: false,
        errors: [{
          code: 'PROFILE_UPDATE_FAILED',
          message: 'Failed to update profile',
        }]
      };
    }
  }

  // ===== PASSWORD MANAGEMENT =====

  /**
   * Change user password
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
    success: boolean;
    errors?: UserError[];
  }> {
    try {
      // Get user
      const user = await UsersRepository.findById(userId);
      if (!user || !user.passwordHash) {
        return {
          success: false,
          errors: [{
            code: 'USER_NOT_FOUND',
            message: 'User not found or password not set',
          }]
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          errors: [{
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Current password is incorrect',
          }]
        };
      }

      // Validate new password
      const validation = this.validateUserData({ password: newPassword, provider: 'local' });
      if (!validation.isValid) {
        return { success: false, errors: validation.errors };
      }

      // Update password
      const updated = await UsersRepository.updatePassword(userId, newPassword);
      
      if (!updated) {
        return {
          success: false,
          errors: [{
            code: 'PASSWORD_UPDATE_FAILED',
            message: 'Failed to update password',
          }]
        };
      }

      // Logout from all devices for security
      await this.logoutAll(userId);

      return { success: true };

    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        errors: [{
          code: 'PASSWORD_CHANGE_FAILED',
          message: 'Failed to change password',
        }]
      };
    }
  }

  /**
   * Forgot password (generate reset token)
   */
  static async forgotPassword(email: string): Promise<{
    success: boolean;
    resetToken?: string;
    errors?: UserError[];
  }> {
    try {
      const user = await UsersRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists for security
        return { success: true }; // Return success regardless
      }

      // Generate reset token (you might want to store this in database)
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // TODO: Store reset token in database with expiration
      // TODO: Send email with reset link

      return {
        success: true,
        resetToken, // In production, don't return this, just send via email
      };

    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        errors: [{
          code: 'FORGOT_PASSWORD_FAILED',
          message: 'Failed to process password reset request',
        }]
      };
    }
  }

  // ===== EMAIL VERIFICATION =====

  /**
   * Verify user email
   */
  static async verifyEmail(userId: string): Promise<{
    success: boolean;
    errors?: UserError[];
  }> {
    try {
      const verified = await UsersRepository.verifyEmail(userId);
      
      if (!verified) {
        return {
          success: false,
          errors: [{
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          }]
        };
      }

      return { success: true };

    } catch (error) {
      console.error('Verify email error:', error);
      return {
        success: false,
        errors: [{
          code: 'EMAIL_VERIFICATION_FAILED',
          message: 'Failed to verify email',
        }]
      };
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Get user by ID (for protected routes)
   */
  static async getUserById(id: string): Promise<{
    success: boolean;
    user?: Omit<User, 'passwordHash'>;
    errors?: UserError[];
  }> {
    try {
      const user = await UsersRepository.findById(id);
      
      if (!user) {
        return {
          success: false,
          errors: [{
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          }]
        };
      }

      // Remove sensitive data
      const { passwordHash, ...safeUser } = user;

      return {
        success: true,
        user: safeUser,
      };

    } catch (error) {
      console.error('Get user error:', error);
      return {
        success: false,
        errors: [{
          code: 'USER_FETCH_FAILED',
          message: 'Failed to fetch user',
        }]
      };
    }
  }

  /**
   * Check if email exists
   */
  static async checkEmailExists(email: string): Promise<{
    exists: boolean;
    errors?: UserError[];
  }> {
    try {
      const exists = await UsersRepository.existsByEmail(email);
      return { exists };

    } catch (error) {
      console.error('Check email error:', error);
      return {
        exists: false,
        errors: [{
          code: 'EMAIL_CHECK_FAILED',
          message: 'Failed to check email',
        }]
      };
    }
  }
}