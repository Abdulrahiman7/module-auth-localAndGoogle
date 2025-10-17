import { pgTable, text, uuid, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // For local authentication
  provider: text('provider').default('local'), // 'local' or 'google'
  googleId: text('google_id'), // For Google OAuth users
  firstName: text('first_name'),
  lastName: text('last_name'),
  picture: text('picture'), // Profile picture URL
  emailVerified: boolean('email_verified').default(false),
  role: text('role').default('user'), // 'user', 'agent', 'admin'
  membership: text('membership').default('free'), // 'free', 'premium', etc.
  mobile: text('mobile'), // Mobile number as text
  createdAt: timestamp('created_at').default(sql`now()`),
  updatedAt: timestamp('updated_at').default(sql`now()`),
});