import winston from 'winston'
import { env } from '../config'

const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
})

logger.add(new winston.transports.Console({
  format: process.env.NODE_ENV === 'production' 
    ? winston.format.simple() 
    : winston.format.simple()
}))

export { logger }
