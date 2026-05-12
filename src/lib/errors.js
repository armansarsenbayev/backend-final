'use strict';


class AppError extends Error {
  /**
   * @param {string} code      
   * @param {string} message    
   * @param {number} statusCode  
   * @param {Array}  details    
   */
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

const errors = {
  ValidationError: (details) =>
    new AppError('VALIDATION_ERROR', 'Validation failed', 422, details),
  Unauthorized: (msg = 'Authentication required') =>
    new AppError('UNAUTHENTICATED', msg, 401),
  InvalidCredentials: () =>
    new AppError('INVALID_CREDENTIALS', 'Invalid credentials', 401),
  InvalidToken: (msg = 'Invalid or expired token') =>
    new AppError('INVALID_TOKEN', msg, 401),
  Forbidden: (msg = 'You do not have permission to perform this action') =>
    new AppError('FORBIDDEN', msg, 403),
  NotFound: (resource = 'Resource') =>
    new AppError('NOT_FOUND', `${resource} not found`, 404),
  Conflict: (msg, code = 'CONFLICT') => new AppError(code, msg, 409),
  GiftNotOpen: () =>
    new AppError('GIFT_NOT_OPEN', 'Gift is not accepting contributions', 409),
  PoolCapExceeded: () =>
    new AppError(
      'POOL_CAP_EXCEEDED',
      'Contribution would exceed the gift target amount',
      422,
    ),
  UnsupportedCurrency: (code) =>
    new AppError('UNSUPPORTED_CURRENCY', `Currency "${code}" is not supported`, 422),
  EmailTaken: () =>
    new AppError('EMAIL_TAKEN', 'Email is already registered', 409),
  UsernameTaken: () =>
    new AppError('USERNAME_TAKEN', 'Username is already taken', 409),
  TooManyRequests: () =>
    new AppError('RATE_LIMIT_EXCEEDED', 'Too many requests, please try again later', 429),
};

module.exports = { AppError, errors };