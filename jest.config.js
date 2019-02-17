const defaults = require('./node_modules/@nerdgeschoss/config/jest.config');

const config = {
  ...defaults,
  collectCoverage: true,
};

module.exports = config;
