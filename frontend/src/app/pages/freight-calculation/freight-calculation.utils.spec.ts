import { hasPendingBorderCheckpoint, isValidEmail, isValidPhone } from './freight-calculation.utils';
import { Waypoint } from './freight-calculation.models';

describe('freight-calculation utils', () => {
  it('validates email', () => {
    expect(isValidEmail('user@test.com')).toBeTrue();
    expect(isValidEmail('wrong-email')).toBeFalse();
  });

  it('validates phone', () => {
    expect(isValidPhone('+380 (67) 123-45-67')).toBeTrue();
    expect(isValidPhone('12')).toBeFalse();
  });

  it('detects pending border checkpoint', () => {
    const points: Waypoint[] = [
      { lat: 50, lng: 30, address: 'Kyiv', country: 'ua', isBorder: false },
      { lat: 52, lng: 21, address: 'Warsaw', country: 'pl', isBorder: false }
    ];
    expect(hasPendingBorderCheckpoint(points)).toBeTrue();
    const withBorder: Waypoint[] = [
      points[0],
      { lat: 51.18, lng: 23.81, address: 'Yahodyn', country: 'pl', isBorder: true },
      points[1]
    ];
    expect(hasPendingBorderCheckpoint(withBorder)).toBeFalse();
  });
});
