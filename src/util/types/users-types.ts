import { users } from '../../db/schema/auth/users';
import { userTokens } from '../../db/schema/auth/userTokens';

// Base types from schema
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserToken = typeof userTokens.$inferSelect;
export type NewUserToken = typeof userTokens.$inferInsert;

// Request/Response interfaces
export interface CreateUserData {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  provider?: 'local' | 'google';
  googleId?: string;
  picture?: string;
  mobile?: string;
  role?: string;
  emailVerified?: boolean;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  picture?: string;
  mobile?: string;
  role?: string;
  emailVerified?: boolean;
}

export interface GoogleUserData {
  email: string;
  googleId: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  emailVerified?: boolean;
}

export interface UserTokenData {
  userId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}

// Authentication response types
export interface LoginResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  mobile?: string;
  role: string;
  provider: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Query options
export interface UserSearchOptions {
  role?: string;
  provider?: string;
  emailVerified?: boolean;
  limit?: number;
  offset?: number;
}

// Error types
export interface UserError {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: UserError[];
}