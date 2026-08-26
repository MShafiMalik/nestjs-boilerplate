/* eslint-disable @typescript-eslint/no-require-imports */
process.env.NODE_ENV = !process.env.NODE_ENV || process.env.NODE_ENV === 'test' ? 'development' : process.env.NODE_ENV;

require('../src/config/load-env');

process.env.E2E_TESTING = 'true';
process.env.THROTTLE_AUTH_LIMIT = '3';
process.env.THROTTLE_LIMIT = '1000';
