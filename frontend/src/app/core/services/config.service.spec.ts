import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';

describe('ConfigService runtime config', () => {
  afterEach(() => {
    delete (window as Window & { __APP_CONFIG__?: unknown }).__APP_CONFIG__;
  });

  it('uses fallback values when runtime config is not provided', () => {
    const service = TestBed.inject(ConfigService);

    expect(service.logoUrl).toBe('https://www.geosun.net.ua');
    expect(service.isServiceStopped).toBeFalse();
  });

  it('overrides defaults from window.__APP_CONFIG__', () => {
    (window as Window & { __APP_CONFIG__?: unknown }).__APP_CONFIG__ = {
      logoUrl: 'https://example.com',
      isServiceStopped: true
    };

    const service = TestBed.inject(ConfigService);

    expect(service.logoUrl).toBe('https://example.com');
    expect(service.isServiceStopped).toBeTrue();
  });
});
