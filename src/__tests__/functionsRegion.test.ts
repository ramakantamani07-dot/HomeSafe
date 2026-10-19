import * as fs from 'fs';
import * as path from 'path';

/**
 * The app and the server must name the same Cloud Functions region: a
 * callable sent elsewhere fails, and the Siri extension's SOS URL would point
 * at nothing. Both are Mumbai for the India launch.
 */
describe('Cloud Functions region', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

  it('is the same on the server and in the app, and it is Mumbai', () => {
    const server = /FUNCTIONS_REGION = '([a-z0-9-]+)'/.exec(read('functions/src/shared/region.ts'))?.[1];
    const app = /firebaseFunctionsRegion: process\.env\.FIREBASE_FUNCTIONS_REGION \?\? '([a-z0-9-]+)'/.exec(
      read('app.config.ts'),
    )?.[1];
    const fallback = /FUNCTIONS_REGION: string = [^?]+\?\? '([a-z0-9-]+)'/.exec(read('src/config/firebase.ts'))?.[1];
    expect(server).toBe('asia-south1');
    expect(app).toBe(server);
    expect(fallback).toBe(server);
  });

  it('is set before any function is defined', () => {
    const index = read('functions/src/index.ts');
    const firstImport = index.split('\n').find((l) => l.startsWith('import ') || l.startsWith('export '));
    expect(firstImport).toBe("import './shared/region';");
  });

  it('no adapter calls getFunctions without the region', () => {
    const dir = path.resolve(__dirname, '../implementations');
    const files: string[] = [];
    const walk = (d: string) =>
      fs.readdirSync(d, { withFileTypes: true }).forEach((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name)),
      );
    walk(dir);
    const offenders = files.filter((f) => /getFunctions\(/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
