'use strict';

const { AppError } = require('../lib/errors');
const { env } = require('../config/env');

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    error: 'Route not found',
    code: 'ROUTE_NOT_FOUND',
    status_code: 404,
    details: [{ field: 'path', issue: `${req.method} ${req.originalUrl}` }],
  });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      status_code: err.statusCode,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Resource already exists',
      code: 'UNIQUE_CONSTRAINT',
      status_code: 409,
      details: err.meta?.target ? [{ field: String(err.meta.target), issue: 'must be unique' }] : undefined,
    });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({
      error: 'Resource not found',
      code: 'NOT_FOUND',
      status_code: 404,
    });
  }
  if (err.code === 'P2003') {
    return res.status(409).json({
      error: 'Foreign key constraint failed',
      code: 'FK_CONSTRAINT',
      status_code: 409,
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Malformed JSON in request body',
      code: 'BAD_REQUEST',
      status_code: 400,
    });
  }


  console.error('[error]', {
    method: req.method,
    path: req.path,
    message: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    status_code: 500,
    ...(env.NODE_ENV === 'development' ? { details: [{ field: 'stack', issue: err.message }] } : {}),
  });
}

module.exports = { notFoundHandler, errorHandler };