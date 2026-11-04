/** Clearly synthetic, unsigned fixtures. No keys, accounts, funds, or signatures are created. */
import {p2pkhTemplate} from '@xo-cash/templates';
import {generateTemplateIdentifier, serializeInvitation, parseTemplate} from '@xo-cash/utils';
import type {XOInvitation} from '@xo-cash/types';
export const referenceIdentifier = generateTemplateIdentifier(parseTemplate(JSON.stringify(p2pkhTemplate)));
export const templateJson = JSON.stringify(p2pkhTemplate,null,2);
export const fixedNow = Date.parse('2026-11-04T10:00:00Z');
export function syntheticInvitation(): XOInvitation {
 return {invitationIdentifier:'11'.repeat(16),createdAtTimestamp:fixedNow - 1000,templateIdentifier:referenceIdentifier,actionIdentifier:'sendSatoshis',commits:[]};
}
export function fixtureInput() {return {templateJson,invitationJson:serializeInvitation(syntheticInvitation()),expectedTemplateIdentifier:referenceIdentifier,network:'chipnet' as const,now:fixedNow};}
