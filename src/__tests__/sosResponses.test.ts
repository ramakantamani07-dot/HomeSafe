import * as fs from 'fs';
import * as path from 'path';

import { SOS_ALERT_CATEGORY, describeResponses } from '../models/SOS';

const time = (d: Date) => d.toISOString().slice(11, 16);
const at = (hhmm: string) => new Date(`2026-10-18T${hhmm}:00Z`);

describe('who has responded, as Emergency mode says it', () => {
  it('says plainly when nobody has yet', () => {
    expect(describeResponses([], time)).toBe("Nobody has said they're responding yet.");
  });

  it('names the one person and when', () => {
    expect(describeResponses([{ name: 'Mum', at: at('21:43') }], time)).toBe('Mum has seen your SOS · 21:43');
  });

  it('lists everyone in the order they answered', () => {
    expect(
      describeResponses(
        [
          { name: 'Dad', at: at('21:45') },
          { name: 'Mum', at: at('21:43') },
          { name: 'Anita', at: at('21:44') },
        ],
        time,
      ),
    ).toBe('Mum, Anita and Dad are responding · first at 21:43');
  });

  it('never claims anyone is coming or that the traveller is safe', () => {
    const said = describeResponses([{ name: 'Mum', at: at('21:43') }, { name: 'Dad', at: at('21:44') }], time);
    expect(said).not.toMatch(/safe|coming|on (her|his|their) way/i);
  });
});

describe('the "I\'m on it" button', () => {
  it('uses the same category name in the app and on the server, or it silently disappears', () => {
    const server = fs.readFileSync(path.resolve(__dirname, '../../functions/src/sos/escalation.ts'), 'utf8');
    expect(server).toContain(`export const SOS_ALERT_CATEGORY = '${SOS_ALERT_CATEGORY}';`);
  });
});
