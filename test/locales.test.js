import test from 'node:test'
import assert from 'node:assert/strict'

import { en, zh } from '../src/locales.js'

test('locale dictionaries stay in sync', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
})
