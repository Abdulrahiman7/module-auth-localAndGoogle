import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const userTokens = pgTable('user_tokens', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id),
  refreshToken: text('refresh_token').notNull().unique(),
  userAgent: text('user_agent'), // Optional: track device/browser
  ipAddress: text('ip_address'), // Optional: track IP
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`),
});