import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeInput } from '../src/snapchat.js';

test('normalizeInput accepts plain usernames', () => {
  assert.equal(normalizeInput('extraavantika'), 'extraavantika');
});

test('normalizeInput parses add URL', () => {
  assert.equal(normalizeInput('https://www.snapchat.com/add/extraavantika'), 'extraavantika');
});

test('normalizeInput parses @ username URL', () => {
  assert.equal(normalizeInput('https://story.snapchat.com/@snapchat'), 'snapchat');
});

test('normalizeInput rejects invalid values', () => {
  assert.throws(() => normalizeInput('%%%'));
});
