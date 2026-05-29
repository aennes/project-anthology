// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { normalizeEntityId, validateEntityId } from '../../scripts/asset-pipeline';

describe('normalizeEntityId', () => {
  it('lowercases driver codes', () => {
    expect(normalizeEntityId('VER')).toBe('ver');
    expect(normalizeEntityId('HAM')).toBe('ham');
  });
  it('lowercases constructor IDs', () => {
    expect(normalizeEntityId('Red_Bull')).toBe('red_bull');
    expect(normalizeEntityId('Ferrari')).toBe('ferrari');
  });
  it('preserves underscores and hyphens', () => {
    expect(normalizeEntityId('albert_park')).toBe('albert_park');
    expect(normalizeEntityId('multi-21-malaysia-2013')).toBe('multi-21-malaysia-2013');
  });
  it('trims whitespace', () => {
    expect(normalizeEntityId('  ver  ')).toBe('ver');
  });
  it('handles empty string', () => {
    expect(normalizeEntityId('')).toBe('');
  });
});

describe('validateEntityId', () => {
  it('accepts valid lowercase IDs', () => {
    expect(validateEntityId('ver')).toBe(true);
    expect(validateEntityId('red_bull')).toBe(true);
    expect(validateEntityId('multi-21-malaysia-2013')).toBe(true);
    expect(validateEntityId('albert_park')).toBe(true);
    expect(validateEntityId('rb')).toBe(true);
  });
  it('rejects path traversal', () => {
    expect(validateEntityId('../etc/passwd')).toBe(false);
    expect(validateEntityId('../../secret')).toBe(false);
    expect(validateEntityId('a/../b')).toBe(false);
  });
  it('rejects uppercase letters', () => {
    expect(validateEntityId('VER')).toBe(false);
    expect(validateEntityId('Red_Bull')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(validateEntityId('')).toBe(false);
  });
  it('rejects IDs over 64 chars', () => {
    expect(validateEntityId('a'.repeat(65))).toBe(false);
    expect(validateEntityId('a'.repeat(64))).toBe(true);
  });
  it('rejects forward slashes', () => {
    expect(validateEntityId('a/b')).toBe(false);
  });
  it('rejects spaces', () => {
    expect(validateEntityId('max verstappen')).toBe(false);
  });
});
