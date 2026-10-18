import * as fs from 'fs';
import * as path from 'path';

import { HandsFreeSosService, HandsFreeSosUnavailableError } from '../services/HandsFreeSosService';
import { MemorySosVault } from '../implementations/handsFreeSos/MemorySosVault';
import { MockHandsFreeSosProvider } from '../implementations/handsFreeSos/MockHandsFreeSosProvider';
import { LOCATION_SAVE_INTERVAL_MS, SIRI_PHRASES, TEST_WINDOW_MS } from '../models/HandsFreeSos';

function setup(available = true) {
  const server = new MockHandsFreeSosProvider();
  const vault = new MemorySosVault(available);
  return { server, vault, service: new HandsFreeSosService(server, vault) };
}

describe('hands-free SOS on this phone', () => {
  it('turning it on stores a key where Siri can read it', async () => {
    const { service, vault } = setup();
    expect(service.isEnabled()).toBe(false);
    await service.enable();
    expect(service.isEnabled()).toBe(true);
    expect(vault.stored?.key).toBeTruthy();
  });

  it('turning it off removes the key from the phone first, then revokes it', async () => {
    const { service, vault, server } = setup();
    await service.enable();
    const keyId = vault.keyId();
    await service.disable();
    expect(vault.stored).toBeNull();
    expect(server.revoked).toEqual([keyId]);
  });

  it('turning it on again revokes the key it replaces', async () => {
    const { service, vault, server } = setup();
    await service.enable();
    const first = vault.keyId();
    await service.enable();
    expect(server.revoked).toEqual([first]);
    expect(vault.keyId()).not.toBe(first);
  });

  it('refuses honestly on a phone without Siri support', async () => {
    const { service } = setup(false);
    await expect(service.enable()).rejects.toBeInstanceOf(HandsFreeSosUnavailableError);
    expect(service.isEnabled()).toBe(false);
  });

  it('signing out wipes the phone even without the server', async () => {
    const { service, vault } = setup();
    await service.enable();
    service.forgetLocally();
    expect(vault.stored).toBeNull();
  });

  it('a test lasts ten minutes', async () => {
    const { service, vault } = setup();
    await service.enable();
    expect(service.startTest(1_000)).toBe(true);
    expect(vault.stored?.testUntil).toBe(1_000 + TEST_WINDOW_MS);
    service.endTest();
    expect(vault.stored?.testUntil).toBeNull();
  });

  it('keeps the last position for Siri at most once a minute, and only when on', async () => {
    const { service, vault } = setup();
    service.recordLocation(51, 0, new Date(0));
    expect(vault.lastLocation).toBeNull();
    await service.enable();
    service.recordLocation(51, 0, new Date(10_000));
    service.recordLocation(52, 0, new Date(20_000));
    expect(vault.lastLocation?.latitude).toBe(51);
    service.recordLocation(53, 0, new Date(10_000 + LOCATION_SAVE_INTERVAL_MS));
    expect(vault.lastLocation?.latitude).toBe(53);
  });
});

describe('the phrases Settings shows', () => {
  it('are exactly the ones Siri listens for', () => {
    const swift = fs.readFileSync(path.resolve(__dirname, '../../targets/sos-intent/SendSOSIntent.swift'), 'utf8');
    const block = swift.slice(swift.indexOf('phrases: ['), swift.indexOf('shortTitle'));
    const listened = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1].replace('\\(.applicationName)', 'WayLoc'));
    expect(listened).toEqual([...SIRI_PHRASES]);
  });
});
