/* eslint-disable @typescript-eslint/no-require-imports */
// Polyfill WebSocket for Node.js < 22 so @supabase/supabase-js works in tests.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require('ws');
}
