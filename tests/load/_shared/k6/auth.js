import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './config.js';

// Authenticated against AUTH_PROVIDER=local. setup() runs once per test;
// the returned token is broadcast to every VU and reused across iterations.
export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({
      email: email || __ENV.LOGIN_EMAIL || 'admin@example.com',
      password: password || __ENV.LOGIN_PASSWORD || 'ChangeMe123!',
    }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } },
  );
  check(res, { 'login ok': (r) => r.status === 200 || r.status === 201 });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`login failed (${res.status}): ${res.body}`);
  }
  const body = res.json();
  // AuthLoginResponse exposes the access token at `accessToken`.
  const token = body.accessToken || body.access_token;
  if (!token) throw new Error('login response missing access token');
  return token;
}

export function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}
