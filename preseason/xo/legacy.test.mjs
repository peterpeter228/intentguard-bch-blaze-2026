import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseInvitation} from '@xo-cash/utils';
import legacy from './fixtures/upstream-legacy-invitation.mjs';
test('unmodified official legacy invitation fails current schema, not a positive signature proof',()=>{assert.throws(()=>parseInvitation(legacy),e=>e.name==='InvitationInvalidError'&&e.message.includes('createdAtTimestamp'));assert.throws(()=>parseInvitation(JSON.parse(JSON.stringify(legacy))),e=>e.name==='InvitationInvalidError'&&e.message.includes('createdAtTimestamp'));});
