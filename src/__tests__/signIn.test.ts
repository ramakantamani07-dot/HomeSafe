import {
  COUNTRIES,
  countryForRegion,
  formatE164,
  formatNational,
  isValidMobile,
  nationalDigits,
  toE164,
  type Country,
} from '../utils/phoneNumber';
import {
  CODE_LOCKOUT_MS,
  MAX_CODE_ATTEMPTS,
  NO_ATTEMPTS,
  SignInLockedError,
  WrongCodeError,
  isLocked,
  recordWrongCode,
  triesLeft,
} from '../models/SignIn';
import { AuthService } from '../services/AuthService';
import type { AuthProvider } from '../providers/AuthProvider';
import type { StorageProvider } from '../providers/StorageProvider';
import { defaultUserSettings, type User } from '../models/User';
import {
  formatCountdown,
  lockedMessage,
  wrongCodeMessage,
} from '../components/auth/signInCopy';

const country = (iso: string): Country => COUNTRIES.find((c) => c.iso === iso)!;

describe('mobile numbers', () => {
  it('accepts Indian mobiles and rejects what cannot receive a text', () => {
    const IN = country('IN');
    expect(isValidMobile(IN, '98765 43210')).toBe(true);
    expect(isValidMobile(IN, '9876543210')).toBe(true);
    expect(isValidMobile(IN, '5876543210')).toBe(false); // not a mobile range
    expect(isValidMobile(IN, '987654321')).toBe(false); // one short
  });

  it('accepts UK mobiles typed with the trunk 0, and rejects landlines', () => {
    const GB = country('GB');
    expect(isValidMobile(GB, '07700 900123')).toBe(true);
    expect(isValidMobile(GB, '7700900123')).toBe(true);
    expect(isValidMobile(GB, '02079460000')).toBe(false); // London landline
  });

  it('has a working rule for every listed country', () => {
    const samples: Record<string, string> = {
      IN: '9876543210',
      GB: '7700900123',
      US: '2025550143',
      AU: '412345678',
      SG: '81234567',
      AE: '501234567',
      MY: '123456789',
    };
    for (const c of COUNTRIES) {
      expect(isValidMobile(c, samples[c.iso])).toBe(true);
    }
  });

  it('spaces the number the way it is read in each country', () => {
    expect(formatNational(country('IN'), '9876543210')).toBe('98765 43210');
    expect(formatNational(country('GB'), '07700900123')).toBe('7700 900123');
    expect(formatNational(country('US'), '2025550143')).toBe('202 555 0143');
    expect(formatNational(country('IN'), '987')).toBe('987');
  });

  it('builds E.164 without the trunk 0, and shows it back grouped', () => {
    expect(toE164(country('GB'), '07700 900123')).toBe('+447700900123');
    expect(nationalDigits('0 7700-900 123')).toBe('7700900123');
    expect(formatE164('+919876543210')).toBe('+91 98765 43210');
    expect(formatE164('+9715012345678')).toBe('+971 50 123 45678');
  });

  it('starts on the device region, falling back for one it does not know', () => {
    expect(countryForRegion('GB').iso).toBe('GB');
    expect(countryForRegion('gb').iso).toBe('GB');
    expect(countryForRegion('FR').iso).toBe('IN');
    expect(countryForRegion(null).iso).toBe('IN');
  });
});

describe('wrong-code lock', () => {
  it(`locks on the ${MAX_CODE_ATTEMPTS}th wrong code, for ten minutes`, () => {
    let a = NO_ATTEMPTS;
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i++) {
      a = recordWrongCode(a, 0);
      expect(isLocked(a, 0)).toBe(false);
      expect(triesLeft(a)).toBe(MAX_CODE_ATTEMPTS - i);
    }
    a = recordWrongCode(a, 0);
    expect(isLocked(a, 0)).toBe(true);
    expect(isLocked(a, CODE_LOCKOUT_MS - 1)).toBe(true);
    expect(isLocked(a, CODE_LOCKOUT_MS)).toBe(false);
  });

  it('forgives the count once a lock has run out', () => {
    let a = NO_ATTEMPTS;
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) a = recordWrongCode(a, 0);
    a = recordWrongCode(a, CODE_LOCKOUT_MS);
    expect(triesLeft(a)).toBe(MAX_CODE_ATTEMPTS - 1);
  });
});

describe('AuthService counts wrong codes', () => {
  const user: User = {
    id: 'u1',
    phone: '+447700900123',
    name: '',
    photoURL: null,
    fcmToken: '',
    settings: defaultUserSettings(),
    createdAt: new Date(0),
  };

  function setup(acceptCode = '123456') {
    let now = 0;
    const sent: string[] = [];
    const auth: AuthProvider = {
      sendOTP: async (phone) => { sent.push(phone); },
      verifyOTP: async (code) => {
        if (code === 'offline') throw new Error('No internet connection.');
        if (code !== acceptCode) throw new WrongCodeError();
        return user;
      },
      getCurrentUser: async () => null,
      signOut: async () => {},
      onAuthStateChanged: () => () => {},
      deleteAuthAccount: async () => {},
    };
    const storage: StorageProvider = {
      getUser: async () => user,
      saveUser: async () => {},
      updateUser: async () => {},
    };
    const service = new AuthService(auth, storage, () => now);
    return { service, sent, advance: (ms: number) => { now += ms; } };
  }

  it('says how many tries are left after each wrong code', async () => {
    const { service } = setup();
    await service.sendOTP(user.phone);
    await expect(service.verifyOTP('000000')).rejects.toMatchObject({ triesLeft: 4 });
    await expect(service.verifyOTP('000000')).rejects.toMatchObject({ triesLeft: 3 });
  });

  it('does not count a failure that was not a wrong code', async () => {
    const { service } = setup();
    await service.sendOTP(user.phone);
    await expect(service.verifyOTP('offline')).rejects.toThrow('No internet');
    await expect(service.verifyOTP('000000')).rejects.toMatchObject({ triesLeft: 4 });
  });

  it('locks on the fifth, refuses to send or check until it ends, then signs in', async () => {
    const { service, sent, advance } = setup();
    await service.sendOTP(user.phone);
    for (let i = 0; i < MAX_CODE_ATTEMPTS - 1; i++) {
      await expect(service.verifyOTP('000000')).rejects.toBeInstanceOf(WrongCodeError);
    }
    await expect(service.verifyOTP('000000')).rejects.toBeInstanceOf(SignInLockedError);
    // Even the right code is refused while locked, and no text is wasted.
    await expect(service.verifyOTP('123456')).rejects.toBeInstanceOf(SignInLockedError);
    await expect(service.sendOTP(user.phone)).rejects.toBeInstanceOf(SignInLockedError);
    expect(sent).toHaveLength(1);

    advance(CODE_LOCKOUT_MS);
    await service.sendOTP(user.phone);
    await expect(service.verifyOTP('123456')).resolves.toMatchObject({ id: 'u1' });
  });

  it('does not carry one number’s lock to another', async () => {
    const { service } = setup();
    await service.sendOTP(user.phone);
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      await service.verifyOTP('000000').catch(() => undefined);
    }
    await expect(service.sendOTP('+919876543210')).resolves.toBeUndefined();
  });

  it('starts the count again after a successful sign-in', async () => {
    const { service } = setup();
    await service.sendOTP(user.phone);
    await service.verifyOTP('000000').catch(() => undefined);
    await service.verifyOTP('123456');
    await service.sendOTP(user.phone);
    await expect(service.verifyOTP('000000')).rejects.toMatchObject({ triesLeft: 4 });
  });
});

describe('sign-in copy', () => {
  it('matches AN4, and gets the singular right', () => {
    expect(wrongCodeMessage(2)).toBe('That code didn’t match. 2 tries left.');
    expect(wrongCodeMessage(1)).toBe('That code didn’t match. 1 try left.');
  });

  it('never understates the wait', () => {
    const now = new Date(0);
    expect(lockedMessage(new Date(CODE_LOCKOUT_MS), now)).toMatch(/in 10 minutes/);
    expect(lockedMessage(new Date(61_000), now)).toMatch(/in 2 minutes/);
    expect(lockedMessage(new Date(5_000), now)).toMatch(/in 1 minute\./);
  });

  it('counts down as m:ss', () => {
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(54)).toBe('0:54');
    expect(formatCountdown(53.2)).toBe('0:54');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});

describe('the DEV pill', () => {
  // Spec §4: compiled out of release builds, not merely hidden. A `__DEV__ &&`
  // guard is what Metro's minifier removes from a release bundle; this keeps
  // every use behind one.
  it('is only ever rendered behind __DEV__', () => {
    const fs = jest.requireActual<typeof import('fs')>('fs');
    const path = jest.requireActual<typeof import('path')>('path');
    const dir = path.join(__dirname, '../../app/(auth)');
    const uses = fs
      .readdirSync(dir)
      .flatMap((f: string) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n'))
      .filter((line: string) => line.includes('<DevPill'));
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) expect(line).toMatch(/__DEV__ &&/);
  });
});
