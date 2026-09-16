import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BRAND,
  classifyInbound,
  confirmationText,
  DEAL_TEXT_MAX,
  dealText,
  forwardText,
  helpText,
  optInReplyText,
  STOP_LINE,
  twiml,
} from '../text-alerts/messages';
import { expectedTwilioSignature, formBodyToParams, isValidTwilioSignature } from '../text-alerts/signature';
import { DEFAULT_DEAL_MESSAGE, formatDealPrice, normalizeDealInput } from '../text-alerts/deal-input';

describe('keyword replies', () => {
  it('confirms on the word in any case or with punctuation, not inside a sentence', () => {
    for (const body of ['YES', 'yes', 'Yes!', ' yes. ', 'Y', 'yeah', 'START', 'Sí', 'si']) {
      expect(classifyInbound(body), body).toBe('confirm');
    }
    expect(classifyInbound("yes I'll take it")).toBe('reply');
  });

  it('recognises STOP and HELP the way carriers do', () => {
    for (const body of ['STOP', 'stop', 'Stop.', 'unsubscribe', 'CANCEL', 'end', 'quit', 'stopall']) {
      expect(classifyInbound(body), body).toBe('stop');
    }
    expect(classifyInbound('help')).toBe('help');
    expect(classifyInbound('INFO')).toBe('help');
  });

  it('treats everything else, including an empty photo-only text, as a reply', () => {
    expect(classifyInbound("I'll take it, can I pick up at 3?")).toBe('reply');
    expect(classifyInbound('')).toBe('reply');
    expect(classifyInbound(null)).toBe('reply');
  });
});

describe('the words on file with Twilio', () => {
  it('carry the brand, the rates line and STOP / HELP', () => {
    for (const text of [confirmationText(), optInReplyText()]) {
      expect(text.startsWith(`${BRAND}:`)).toBe(true);
      expect(text).toMatch(/Msg & data rates may apply/);
      expect(text).toMatch(/STOP/);
      expect(text).toMatch(/HELP/);
    }
    expect(confirmationText()).toMatch(/Reply YES/);
    expect(helpText()).toContain('(239) 404-8505');
  });

  it('builds the deal text with the STOP line exactly once and inside the cap', () => {
    const text = dealText({ title: '14K rope chain · 22 in · 18.4 g', price: '$1,460', message: DEFAULT_DEAL_MESSAGE });
    expect(text).toBe(`${BRAND}: 14K rope chain · 22 in · 18.4 g - $1,460. ${DEFAULT_DEAL_MESSAGE} ${STOP_LINE}`);
    const own = dealText({ title: 'Ring', price: '$300', message: 'First reply takes it. Reply STOP to opt out.' });
    expect(own.match(/reply stop/gi)).toHaveLength(1);
    const long = dealText({ title: 'x', price: '$1', message: 'a'.repeat(2000) });
    expect(long.length).toBeLessThanOrEqual(DEAL_TEXT_MAX);
    expect(long.endsWith(STOP_LINE)).toBe(true);
  });

  it('forwards a reply with who, which deal and the first flag', () => {
    expect(forwardText({ fromPhone: '+12395550148', name: 'Maria Alvarez', dealTitle: '14K rope chain', body: "I'll take it", isFirst: true }))
      .toBe('Maria Alvarez (239) 555-0148 on "14K rope chain" [1st]: I\'ll take it');
    expect(forwardText({ fromPhone: '+12395550177', name: null, dealTitle: null, body: '', isFirst: false }))
      .toBe('(239) 555-0177: (photo or empty message)');
  });

  it('escapes the TwiML reply', () => {
    expect(twiml()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    expect(twiml('Tom & Jerry <3')).toContain('<Message>Tom &amp; Jerry &lt;3</Message>');
  });
});

describe('Twilio request signatures', () => {
  // The worked example from Twilio's docs (auth token 12345, URL + params below).
  const token = '12345';
  const url = 'https://mycompany.com/myapp.php?foo=1&bar=2';
  const params = { CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212' };

  it('matches the documented example and rejects anything else', () => {
    const expected = expectedTwilioSignature(token, url, params);
    expect(expected).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
    expect(isValidTwilioSignature(token, url, params, expected)).toBe(true);
    expect(isValidTwilioSignature(token, url, params, 'nope')).toBe(false);
    expect(isValidTwilioSignature(token, url, params, null)).toBe(false);
    expect(isValidTwilioSignature('other', url, params, expected)).toBe(false);
  });

  it('parses a form body', () => {
    expect(formBodyToParams('From=%2B12395550148&Body=YES%21&NumMedia=0')).toEqual({ From: '+12395550148', Body: 'YES!', NumMedia: '0' });
  });
});

describe('the deal form', () => {
  it('formats a price the way the card prints it', () => {
    expect(formatDealPrice('1460')).toBe('$1,460');
    expect(formatDealPrice('$1,460')).toBe('$1,460');
    expect(formatDealPrice('89.5')).toBe('$89.50');
    expect(formatDealPrice('')).toBeNull();
    expect(formatDealPrice('free')).toBeNull();
    expect(formatDealPrice('0')).toBeNull();
  });

  it('needs a line and a price, defaults the message', () => {
    expect(normalizeDealInput({ title: '  14K rope chain  ', price: '1460' })).toEqual({ value: { title: '14K rope chain', price_text: '$1,460', message: DEFAULT_DEAL_MESSAGE } });
    expect(normalizeDealInput({ price: '1460' })).toHaveProperty('error');
    expect(normalizeDealInput({ title: 'Ring', price: 'lots' })).toHaveProperty('error');
  });
});

describe('source guards', () => {
  const SRC = join(process.cwd(), 'src');
  const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

  it('both webhooks refuse unsigned requests', () => {
    for (const route of ['app/api/webhooks/twilio/inbound/route.ts', 'app/api/webhooks/twilio/status/route.ts']) {
      const source = read(route);
      expect(source).toContain('isValidTwilioSignature(');
      expect(source).toContain("req.headers.get('x-twilio-signature')");
    }
  });

  it('a not-yet-verified number never uses up a subscriber\'s confirmation attempts', () => {
    const source = read('lib/text-alerts/confirmations.ts');
    expect(source).toContain('NUMBER_NOT_READY_CODES = new Set([30032, 30034])');
    expect(source).toContain('NUMBER_NOT_READY_CODES.has(code)');
    expect(source).toContain('sms_confirmation_attempts: attempts - 1');
  });

  it('the sign-up sends the confirmation but can never fail on it', () => {
    const source = read('app/api/subscribe/route.ts');
    expect(source).toContain('await sendConfirmation(phone)');
    expect(source).toMatch(/try \{\s*await sendConfirmation\(phone\);\s*\} catch/);
  });

  it('deal sends are written before they go out and only to confirmed numbers', () => {
    const deals = read('lib/text-alerts/deals.ts');
    expect(deals).toContain("status: 'queued'");
    expect(deals).toContain(".eq('sms_status', 'confirmed')");
    expect(deals.indexOf(".upsert(rows")).toBeLessThan(deals.indexOf('runDealSendPass(dealId, SEND_PASS_LIMIT)'));
  });

  it('the Storage GC keeps deal photos and pictures', () => {
    const gc = read('app/api/admin/storage-gc/route.ts');
    expect(gc).toContain(".from('text_deals')");
    expect(gc).toContain('referencedPaths.add(row.card_path)');
  });

  it('the deal routes trace the brand fonts into their bundles', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
    expect(config).toContain("'/api/admin/text-deals/**': ['./src/assets/fonts/**']");
    expect(config).toContain("'/api/admin/text-alerts/**': ['./src/assets/fonts/**']");
  });
});
