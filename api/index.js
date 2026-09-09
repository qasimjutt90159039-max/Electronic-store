/**
 * Vercel Serverless Function Entry Point
 * Routes all /api/* endpoints through the unified backend engine
 */

const handleRequest = require('../server.js');

module.exports = (req, res) => {
  return handleRequest(req, res);
};
