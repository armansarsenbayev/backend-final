'use strict';

const { errors } = require('../lib/errors');


function validate({ body, query, params } = {}) {
  return (req, _res, next) => {
    const issues = [];

    if (body) {
      const result = body.safeParse(req.body);
      if (!result.success) {
        issues.push(...result.error.issues.map((i) => ({
          field: i.path.join('.') || 'body',
          issue: i.message,
        })));
      } else {
        req.body = result.data;
      }
    }

    if (query) {
      const result = query.safeParse(req.query);
      if (!result.success) {
        issues.push(...result.error.issues.map((i) => ({
          field: i.path.join('.') || 'query',
          issue: i.message,
        })));
      } else {
        req.query = result.data;
      }
    }

    if (params) {
      const result = params.safeParse(req.params);
      if (!result.success) {
        issues.push(...result.error.issues.map((i) => ({
          field: i.path.join('.') || 'params',
          issue: i.message,
        })));
      } else {
        req.params = result.data;
      }
    }

    if (issues.length > 0) {
      return next(errors.ValidationError(issues));
    }

    next();
  };
}

module.exports = { validate };
