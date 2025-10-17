// JWT and authentication related types
import { Request } from 'express';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  provider: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    provider: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  resetToken: string;
  newPassword: string;
}

export interface GoogleAuthData {
  id: string;
  email: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
}

// Response types
export interface AuthResponse {
  success: boolean;
  user?: any;
  accessToken?: string;
  refreshToken?: string;
  message?: string;
  errors?: any[];
}

export interface ProfileResponse {
  success: boolean;
  user?: any;
  message?: string;
  errors?: any[];
}