import { isUnreachableNumber } from '../utils/deviceLinks';

describe('isUnreachableNumber', () => {
  it('catches placeholders and the range reserved for fiction', () => {
    expect(isUnreachableNumber('+910000000000')).toBe(true);
    expect(isUnreachableNumber('+911111111111')).toBe(true);
    expect(isUnreachableNumber('+447700900123')).toBe(true);
  });

  it('leaves real numbers alone', () => {
    expect(isUnreachableNumber('+919876543210')).toBe(false);
    expect(isUnreachableNumber('+447911123456')).toBe(false);
  });

  it('never blocks an emergency number', () => {
    for (const n of ['999', '112', '911', '000', '111']) expect(isUnreachableNumber(n)).toBe(false);
  });
});
