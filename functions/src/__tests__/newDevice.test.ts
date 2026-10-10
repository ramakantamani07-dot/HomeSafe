import { planNewDeviceAlert, platformName } from '../security/newDevice';

const conn = (user1Id: string, user2Id: string, status = 'ACTIVE') => ({ user1Id, user2Id, status });

describe('new-device sign-in warning', () => {
  it('says nothing about the first phone on an account', () => {
    expect(
      planNewDeviceAlert({ userId: 'u', deviceId: 'd1', devices: [{ id: 'd1', pushToken: 't1' }], connections: [conn('u', 'mum')] }),
    ).toBeNull();
  });

  it('warns the other phones and everyone in an active family connection', () => {
    const plan = planNewDeviceAlert({
      userId: 'u',
      deviceId: 'new',
      devices: [
        { id: 'old', pushToken: 'tok-old' },
        { id: 'new', pushToken: 'tok-new' },
        { id: 'tablet', pushToken: null },
      ],
      connections: [conn('u', 'mum'), conn('dad', 'u'), conn('u', 'ex', 'CANCELLED')],
    });
    expect(plan).toEqual({ ownTokens: ['tok-old'], familyIds: ['mum', 'dad'] });
  });

  it('never warns the new phone about itself, and sends each token once', () => {
    const plan = planNewDeviceAlert({
      userId: 'u',
      deviceId: 'new',
      devices: [
        { id: 'a', pushToken: 'same' },
        { id: 'b', pushToken: 'same' },
        { id: 'new', pushToken: 'tok-new' },
      ],
      connections: [],
    });
    expect(plan?.ownTokens).toEqual(['same']);
  });

  it('names the platform without guessing a model', () => {
    expect(platformName('ios')).toBe('an iPhone');
    expect(platformName('android')).toBe('an Android phone');
    expect(platformName(undefined)).toBe('a device');
  });
});
