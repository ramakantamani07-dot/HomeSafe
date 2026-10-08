import {
  allowsLocationLookup,
  isTerminal,
  type ConsentStatus,
} from '../models/Consent';
import {
  applyConsentEvent,
  canRevoke,
  type ConsentEventKind,
} from '../services/ConsentStateMachine';

const ALL_STATUSES: ConsentStatus[] = [
  'PENDING_SMS',
  'SMS_APPROVED',
  'OPERATOR_PENDING',
  'ACTIVE',
  'DECLINED',
  'EXPIRED',
  'REVOKED',
];

const ALL_EVENTS: ConsentEventKind[] = [
  'sms-approved',
  'sms-declined',
  'operator-requested',
  'operator-approved',
  'operator-declined',
  'expire',
  'revoke',
];

describe('the happy path', () => {
  it('walks PENDING_SMS → SMS_APPROVED → OPERATOR_PENDING → ACTIVE', () => {
    expect(applyConsentEvent('PENDING_SMS', 'sms-approved')?.to).toBe('SMS_APPROVED');
    expect(applyConsentEvent('SMS_APPROVED', 'operator-requested')?.to).toBe('OPERATOR_PENDING');
    expect(applyConsentEvent('OPERATOR_PENDING', 'operator-approved')?.to).toBe('ACTIVE');
  });
});

describe('ACTIVE cannot be reached by any shortcut', () => {
  it('is reachable only from OPERATOR_PENDING, and only by operator approval', () => {
    // The guarantee the whole feature rests on: a member who said YES but whose
    // operator has not authorised must not be locatable. If any other path to
    // ACTIVE existed, consent would be a formality.
    const routes: Array<[ConsentStatus, ConsentEventKind]> = [];
    for (const from of ALL_STATUSES) {
      for (const event of ALL_EVENTS) {
        if (applyConsentEvent(from, event)?.to === 'ACTIVE') routes.push([from, event]);
      }
    }
    expect(routes).toEqual([['OPERATOR_PENDING', 'operator-approved']]);
  });

  it('refuses to skip the operator step', () => {
    expect(applyConsentEvent('PENDING_SMS', 'operator-approved')).toBeNull();
    expect(applyConsentEvent('SMS_APPROVED', 'operator-approved')).toBeNull();
  });
});

describe('only ACTIVE permits a lookup', () => {
  it('refuses every other state', () => {
    for (const status of ALL_STATUSES) {
      expect(allowsLocationLookup(status)).toBe(status === 'ACTIVE');
    }
  });
});

describe('STOP works at any time', () => {
  it('revokes from every non-terminal state', () => {
    // The spec requires STOP to work "any time". Someone texting STOP must
    // never be refused because of internal state they cannot see.
    for (const status of ALL_STATUSES.filter((s) => !isTerminal(s))) {
      expect(applyConsentEvent(status, 'revoke')?.to).toBe('REVOKED');
      expect(canRevoke(status)).toBe(true);
    }
  });

  it('is a no-op, not an error, once already terminal', () => {
    for (const status of ALL_STATUSES.filter(isTerminal)) {
      expect(canRevoke(status)).toBe(false);
    }
  });
});

describe('terminal states are final', () => {
  it('accepts no event at all', () => {
    for (const status of ALL_STATUSES.filter(isTerminal)) {
      for (const event of ALL_EVENTS) {
        expect(applyConsentEvent(status, event)).toBeNull();
      }
    }
  });
});

describe('an active consent does not lapse quietly', () => {
  it('cannot expire — it ends only because somebody ended it', () => {
    // A member who believes they are sharing should not silently stop; the
    // guardian would see a stale "can't find them" with no explanation.
    expect(applyConsentEvent('ACTIVE', 'expire')).toBeNull();
    expect(applyConsentEvent('ACTIVE', 'revoke')?.to).toBe('REVOKED');
  });
});

describe('transitions carry why they happened', () => {
  it('records the trigger for the audit trail', () => {
    expect(applyConsentEvent('PENDING_SMS', 'sms-approved')?.trigger).toBe('member-replied');
    expect(applyConsentEvent('OPERATOR_PENDING', 'operator-approved')?.trigger).toBe(
      'operator-responded',
    );
    expect(applyConsentEvent('PENDING_SMS', 'expire')?.trigger).toBe('expired');
  });

  it('lets a caller name a more specific trigger', () => {
    // An operator-initiated revocation and a member texting STOP both land on
    // REVOKED, and an audit has to tell them apart.
    expect(applyConsentEvent('ACTIVE', 'revoke', 'operator-revoked')?.trigger).toBe(
      'operator-revoked',
    );
  });
});
