/**
 * Database layer exports
 */

// Client
export { initializeDatabase, getDatabase, closeDatabase, transaction } from './client.js';

// Errors
export { DatabaseError } from './errors.js';

// Query modules
export * from './queries/streams.js';
export * from './queries/commits.js';
export * from './queries/history.js';
export * from './queries/stats.js';
