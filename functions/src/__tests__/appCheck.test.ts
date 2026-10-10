import { appCheckMode, appCheckOutcome } from '../shared/appCheck';

describe('App Check mode', () => {
  it('monitors unless enforcement is asked for by name', () => {
    expect(appCheckMode({})).toBe('monitor');
    expect(appCheckMode({ APP_CHECK_MODE: '' })).toBe('monitor');
    expect(appCheckMode({ APP_CHECK_MODE: 'monitor' })).toBe('monitor');
    // A typo must never lock every real user out of Find.
    expect(appCheckMode({ APP_CHECK_MODE: 'enforced' })).toBe('monitor');
    expect(appCheckMode({ APP_CHECK_MODE: 'true' })).toBe('monitor');
  });

  it('enforces on the exact word, however it is written', () => {
    expect(appCheckMode({ APP_CHECK_MODE: 'enforce' })).toBe('enforce');
    expect(appCheckMode({ APP_CHECK_MODE: ' Enforce ' })).toBe('enforce');
  });
});

describe('App Check outcome', () => {
  it('is verified only when the request carried a valid token', () => {
    expect(appCheckOutcome({ app: { appId: '1:123:ios:abc', token: {} as never } })).toBe('verified');
    expect(appCheckOutcome({ app: undefined })).toBe('missing');
  });
});
