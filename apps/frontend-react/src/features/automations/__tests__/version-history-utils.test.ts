import { describe, it, expect } from 'vitest';
import { resolveUserDisplay } from '../editor/panels/version-history-panel';

describe('resolveUserDisplay', () => {
  it('returns userName when available', () => {
    expect(resolveUserDisplay({ userName: 'Alice', userEmail: 'alice@test.com', user: '2' })).toBe('Alice');
  });

  it('returns userEmail when userName is missing', () => {
    expect(resolveUserDisplay({ userEmail: 'bob@test.com', user: '3' })).toBe('bob@test.com');
  });

  it('parses legacy JSON user field with email', () => {
    expect(resolveUserDisplay({ user: '{"email":"carol@test.com"}' })).toBe('carol@test.com');
  });

  it('parses legacy JSON user field with name', () => {
    expect(resolveUserDisplay({ user: '{"name":"Dave","email":"dave@test.com"}' })).toBe('Dave');
  });

  it('returns Unknown when user is a numeric ID string (parsed as JSON number)', () => {
    // '42' is valid JSON (a number), so JSON.parse succeeds but yields no name/email
    expect(resolveUserDisplay({ user: '42' })).toBe('Unknown');
  });

  it('returns raw user string when JSON parse fails', () => {
    expect(resolveUserDisplay({ user: 'some-text' })).toBe('some-text');
  });

  it('returns Unknown for empty user string', () => {
    expect(resolveUserDisplay({ user: '' })).toBe('Unknown');
  });

  it('prefers userName over legacy JSON', () => {
    expect(resolveUserDisplay({ userName: 'Eve', user: '{"name":"Old Name"}' })).toBe('Eve');
  });

  it('prefers userEmail over legacy JSON when no userName', () => {
    expect(resolveUserDisplay({ userEmail: 'frank@test.com', user: '{"name":"Old"}' })).toBe('frank@test.com');
  });
});
