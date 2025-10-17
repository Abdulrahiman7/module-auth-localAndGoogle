import { eq, and, or, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/auth/users';
import { userTokens } from '../db/schema/auth/userTokens';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
  User,
  NewUser,
  UserToken,
  NewUserToken,
  CreateUserData,
  UpdateUserData,
  GoogleUserData,
  UserTokenData,
  LoginResult,
  UserProfile,
  UserSearchOptions,
  UserError,
  ValidationResult
} from '../util/types/users-types';

export class UsersRepository {
  
  // ===== USER CRUD OPERATIONS =====

  /**
   * Create a new user (local registration)
   */
  static async createUser(userData: CreateUserData): Promise<Omit<User, 'passwordHash'>> {
    const hashedPassword = userData.password ? 
      await bcrypt.hash(userData.password, 12) : null;

    const [newUser] = await db.insert(users).values({
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      passwordHash: hashedPassword,
      provider: userData.provider || 'local',
      googleId: userData.googleId,
      picture: userData.picture,
      mobile: userData.mobile,
      role: userData.role || 'user',
      emailVerified: userData.emailVerified || false,
    }).returning();

    // Return user without password hash
    const { passwordHash, ...safeUser } = newUser;
    return safeUser;
  }

  /**
   * Create or update user from Google OAuth
   */
  static async createOrUpdateGoogleUser(googleData: GoogleUserData): Promise<Omit<User, 'passwordHash'>> {
    // Check if user exists by email or googleId
    const existingUser = await this.findByEmailOrGoogleId(googleData.email, googleData.googleId);

    if (existingUser) {
      // Update existing user with Google data
      const [updatedUser] = await db.update(users)
        .set({
          firstName: googleData.firstName || existingUser.firstName,
          lastName: googleData.lastName || existingUser.lastName,
          picture: googleData.picture || existingUser.picture,
          googleId: googleData.googleId,
          provider: 'google',
          emailVerified: true, // Google emails are verified
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      const { passwordHash, ...safeUser } = updatedUser;
      return safeUser;
    }

    // Create new Google user
    return await this.createUser({
      email: googleData.email,
      firstName: googleData.firstName,
      lastName: googleData.lastName,
      picture: googleData.picture,
      provider: 'google',
      googleId: googleData.googleId,
      emailVerified: true,
    });
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return user || null;
  }

  /**
   * Find user by Google ID
   */
  static async findByGoogleId(googleId: string): Promise<User | null> {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.googleId, googleId))
      .limit(1);

    return user || null;
  }

  /**
   * Find user by email or Google ID (for OAuth linking)
   */
  static async findByEmailOrGoogleId(email: string, googleId: string): Promise<User | null> {
    const [user] = await db.select()
      .from(users)
      .where(or(
        eq(users.email, email),
        eq(users.googleId, googleId)
      ))
      .limit(1);

    return user || null;
  }

  /**
   * Update user data
   */
  static async updateUser(id: string, updateData: UpdateUserData): Promise<Omit<User, 'passwordHash'> | null> {
    const [updatedUser] = await db.update(users)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!updatedUser) return null;

    const { passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }

  /**
   * Update user password
   */
  static async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    const [updatedUser] = await db.update(users)
      .set({
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return !!updatedUser;
  }

  /**
   * Verify user email
   */
  static async verifyEmail(id: string): Promise<boolean> {
    const [updatedUser] = await db.update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return !!updatedUser;
  }

  /**
   * Verify user password for login
   */
  static async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    
    if (!user || !user.passwordHash || user.provider !== 'local') {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  /**
   * Check if user exists by email
   */
  static async existsByEmail(email: string): Promise<boolean> {
    const [user] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return !!user;
  }

  /**
   * Get user profile (safe data for frontend)
   */
  static async getUserProfile(id: string): Promise<Omit<User, 'passwordHash'> | null> {
    const user = await this.findById(id);
    if (!user) return null;

    // Remove sensitive data
    const { passwordHash, ...safeUserData } = user;
    return safeUserData;
  }

  // ===== REFRESH TOKEN OPERATIONS =====

  /**
   * Create refresh token for user
   */
  static async createRefreshToken(tokenData: UserTokenData): Promise<UserToken> {
    const [newToken] = await db.insert(userTokens).values({
      userId: tokenData.userId,
      refreshToken: tokenData.refreshToken,
      userAgent: tokenData.userAgent,
      ipAddress: tokenData.ipAddress,
      expiresAt: tokenData.expiresAt,
    }).returning();

    return newToken;
  }

  /**
   * Find valid refresh token
   */
  static async findValidRefreshToken(refreshToken: string): Promise<(UserToken & { user: User }) | null> {
    const [result] = await db.select({
      token: userTokens,
      user: users,
    })
    .from(userTokens)
    .innerJoin(users, eq(userTokens.userId, users.id))
    .where(eq(userTokens.refreshToken, refreshToken))
    .limit(1);

    if (!result) return null;

    // Check if token is expired
    if (new Date() > new Date(result.token.expiresAt)) {
      // Delete expired token
      await this.deleteRefreshToken(refreshToken);
      return null;
    }

    return {
      ...result.token,
      user: result.user,
    };
  }

  /**
   * Delete refresh token (logout)
   */
  static async deleteRefreshToken(refreshToken: string): Promise<boolean> {
    const [deletedToken] = await db.delete(userTokens)
      .where(eq(userTokens.refreshToken, refreshToken))
      .returning();

    return !!deletedToken;
  }

  /**
   * Delete all refresh tokens for user (logout all devices)
   */
  static async deleteAllUserRefreshTokens(userId: string): Promise<number> {
    const deletedTokens = await db.delete(userTokens)
      .where(eq(userTokens.userId, userId))
      .returning();

    return deletedTokens.length;
  }

  // ===== UTILITY METHODS =====

  /**
   * Get user statistics (for admin)
   */
  static async getUserStats(): Promise<{
    totalUsers: number;
    localUsers: number;
    googleUsers: number;
    verifiedUsers: number;
    agentUsers: number;
  }> {
    const allUsers = await db.select().from(users);
    
    return {
      totalUsers: allUsers.length,
      localUsers: allUsers.filter((u: User) => u.provider === 'local').length,
      googleUsers: allUsers.filter((u: User) => u.provider === 'google').length,
      verifiedUsers: allUsers.filter((u: User) => u.emailVerified).length,
      agentUsers: allUsers.filter((u: User) => u.role === 'agent').length,
    };
  }

  /**
   * Search users (for admin/agent lookup)
   */
  static async searchUsers(query: string, limit: number = 10): Promise<Omit<User, 'passwordHash'>[]> {
    const foundUsers = await db.select()
      .from(users)
      .where(or(
        eq(users.email, query),
        eq(users.firstName, query),
        eq(users.lastName, query)
      ))
      .limit(limit);

    // Remove sensitive data
    return foundUsers.map(({ passwordHash, ...user }: User) => user);
  }
}