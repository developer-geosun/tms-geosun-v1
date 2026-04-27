import { Injectable } from '@angular/core';
import {
  HereGeocodeItem,
  HereGeocodeResponse,
  HereReverseGeocodeResponse,
  HereRoute,
  HereRouteResponse
} from './freight-here.api.models';
import { FreightLang, Waypoint } from './freight-calculation-here.models';

@Injectable({ providedIn: 'root' })
export class FreightHereApiService {
  async searchAddress(query: string, lang: FreightLang, hereApiKey: string): Promise<HereGeocodeItem[]> {
    if (!hereApiKey) {
      return [];
    }
    const resolvedLang = this.getHereLanguage(lang);
    const url = new URL('https://geocode.search.hereapi.com/v1/geocode');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', resolvedLang);
    url.searchParams.set('apiKey', hereApiKey);
    const response = await fetch(url.toString());
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as HereGeocodeResponse;
    return (data.items ?? []).map((item) => ({
      lat: String(item.position.lat),
      lon: String(item.position.lng),
      display_name: item.title,
      address: {
        country_code: this.normalizeCountryCode(item.address?.countryCode) ?? undefined
      }
    }));
  }

  async reverseGeocode(
    lat: number,
    lng: number,
    lang: FreightLang,
    hereApiKey: string
  ): Promise<{ address: string; country: string | null }> {
    if (!hereApiKey) {
      return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, country: null };
    }
    const resolvedLang = this.getHereLanguage(lang);
    const url = new URL('https://revgeocode.search.hereapi.com/v1/revgeocode');
    url.searchParams.set('at', `${lat},${lng}`);
    url.searchParams.set('limit', '1');
    url.searchParams.set('lang', resolvedLang);
    url.searchParams.set('apiKey', hereApiKey);
    const response = await fetch(url.toString());
    if (!response.ok) {
      return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, country: null };
    }
    const data = (await response.json()) as HereReverseGeocodeResponse;
    const first = data.items?.[0];
    return {
      address: first?.title ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      country: this.normalizeCountryCode(first?.address?.countryCode)
    };
  }

  async fetchRoute(points: Waypoint[], hereApiKey: string): Promise<HereRoute | null> {
    if (!hereApiKey) {
      return null;
    }
    const url = new URL('https://router.hereapi.com/v8/routes');
    url.searchParams.set('transportMode', 'truck');
    url.searchParams.set('origin', `${points[0].lat},${points[0].lng}`);
    url.searchParams.set('destination', `${points[points.length - 1].lat},${points[points.length - 1].lng}`);
    for (const point of points.slice(1, -1)) {
      url.searchParams.append('via', `${point.lat},${point.lng}`);
    }
    url.searchParams.set('return', 'polyline,summary');
    url.searchParams.set('apiKey', hereApiKey);
    const response = await fetch(url.toString());
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as HereRouteResponse;
    return payload.routes[0] ?? null;
  }

  private getHereLanguage(lang: FreightLang): string {
    if (lang === 'uk') {
      return 'uk-UA';
    }
    if (lang === 'ru') {
      return 'ru-RU';
    }
    return 'en-US';
  }

  /** Нормалізує код країни HERE до ISO-2 (нижній регістр) для сумісності з логікою КПП */
  private normalizeCountryCode(code?: string): string | null {
    if (!code) {
      return null;
    }
    const upper = code.toUpperCase();
    const iso3ToIso2: Record<string, string> = {
      UKR: 'ua',
      POL: 'pl',
      SVK: 'sk',
      HUN: 'hu',
      ROU: 'ro',
      MDA: 'md',
      RUS: 'ru',
      BLR: 'by'
    };
    if (upper.length === 2) {
      return upper.toLowerCase();
    }
    return iso3ToIso2[upper] ?? null;
  }
}
