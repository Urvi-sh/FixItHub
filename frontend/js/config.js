// The only place that knows where the backend lives.
// - Opened via the Express server (http://localhost:5000): same origin, relative URLs.
// - Opened via Live Server / another host: point to the backend on port 5000.
const sameOrigin = location.port === '5000' || (location.protocol === 'https:' && !['127.0.0.1', 'localhost'].includes(location.hostname));
export const SERVER_URL = sameOrigin ? '' : 'http://localhost:5000';
export const API_URL = `${SERVER_URL}/api/v1`;
