import dotenv from 'dotenv'

dotenv.config()

export const env = {
  PORT: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  HOST: process.env.HOST || '0.0.0.0',
  
  DATABASE_URL: process.env.DATABASE_URL || '',
  
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
}
