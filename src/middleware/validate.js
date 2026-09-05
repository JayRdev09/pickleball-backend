'use strict';

const R = require('../utils/response');

/**
 * Validation middleware factory using Joi schemas.
 * Validates req.body, req.params, or req.query.
 *
 * @param {import('joi').Schema} schema  Joi schema to validate against
 * @param {'body'|'params'|'query'} target  Which part of the request to validate
 */
function validate(schema, target = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[target], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map((d) => ({
        field: d.path.join('.'),
        message: d.message.replace(/['"]/g, ''),
      }));
      return R.badRequest(res, 'Validation failed', details);
    }

    // Replace the target with the sanitized/validated value
    req[target] = value;
    next();
  };
}

module.exports = { validate };
