// @ts-ignore -- Vitest runs in Node; the uni-app production tsconfig intentionally omits Node types.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) =>
  readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')

describe('account profile contract', () => {
  it.each(['src/api/user.ts', 'src/stores/profile.ts', 'src/pages/profile/edit.vue'])(
    'does not retain training profile fields in %s',
    (path) => {
      expect(readSource(path)).not.toMatch(/trainingGoal|experienceLevel/)
    }
  )
})
