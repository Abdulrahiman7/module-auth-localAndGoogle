import dotenv from "dotenv";
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as authSchema from './schema/auth/users';
import * as tokenSchema from './schema/auth/userTokens';

// Database configuration from environment variables
const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: String(process.env.DB_PASSWORD || ''),
  database: process.env.DB_NAME || 'whiteyards_db',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait when connecting
};

// Debug database configuration (remove in production)
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Database Configuration:');
  console.log(`   • Host: ${connectionConfig.host}`);
  console.log(`   • Port: ${connectionConfig.port}`);
  console.log(`   • User: ${connectionConfig.user}`);
  console.log(`   • Database: ${connectionConfig.database}`);
  console.log(`   • Password set: ${connectionConfig.password ? 'Yes' : 'No'}`);
  console.log(`   • SSL: ${connectionConfig.ssl}`);
}

// Create connection pool
const pool = new Pool(connectionConfig);

// Create Drizzle instance with schema
export const db = drizzle(pool, { 
  schema: { ...authSchema, ...tokenSchema },
  logger: process.env.NODE_ENV === 'development'
});

// Connection test function
export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error instanceof Error ? error.message : error);
    console.log('💡 Make sure PostgreSQL is running and credentials are correct');
    return false;
  }
};

// Graceful shutdown
export const closeConnection = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('✅ Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

// Handle process termination
process.on('SIGINT', closeConnection);
process.on('SIGTERM', closeConnection);