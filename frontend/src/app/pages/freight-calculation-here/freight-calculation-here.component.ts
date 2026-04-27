import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';
import { ConfigService } from '../../core/services/config.service';
import { CHECKPOINTS_DATA } from './freight-checkpoints.data';
import { Checkpoint, FreightLang, FreightRequestPayload, Waypoint } from './freight-calculation-here.models';
import { hasPendingBorderCheckpoint, isValidEmail, isValidPhone } from './freight-calculation-here.utils';
import { FreightRequestApiService } from './freight-request-api.service';
import { FreightHereApiService } from './freight-here-api.service';
import { HereGeocodeItem } from './freight-here.api.models';
import { decodeHereFlexiblePolyline } from './freight-here-polyline.utils';

@Component({
  selector: 'app-freight-calculation-here',
  templateUrl: './freight-calculation-here.component.html',
  styleUrls: ['./freight-calculation-here.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [TranslateModule, ReactiveFormsModule, MatExpansionModule, MatFormFieldModule, MatSelectModule]
})
export class FreightCalculationHereComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) private readonly mapContainer!: ElementRef<HTMLDivElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly requestApi = inject(FreightRequestApiService);
  private readonly hereApi = inject(FreightHereApiService);
  private readonly translate = inject(TranslateService);
  private readonly config = inject(ConfigService);

  readonly waypoints = signal<Waypoint[]>([]);
  readonly segmentDistances = signal<number[]>([]);
  readonly searchResults = signal<HereGeocodeItem[]>([]);
  readonly highlightedSearchIndex = signal(-1);
  readonly selectedWaypointIndex = signal<number | null>(null);
  readonly selectedCountryBySegment = signal<Record<number, string | null>>({});
  readonly requestOpen = signal(false);
  readonly isSearching = signal(false);
  readonly isSubmitting = signal(false);
  readonly toastMessage = signal('');
  readonly dropdownSegmentIndex = signal<number | null>(null);
  /** Порожнє значення другого mat-select після вибору КПП або зміни країни */
  readonly borderCheckpointSelectValue = signal<Record<number, string>>({});

  readonly requestForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    preferredStartDate: [''],
    routeComment: ['']
  });

  readonly totalDistanceMeters = computed(() => this.segmentDistances().reduce((sum, distance) => sum + distance, 0));
  readonly hasRoute = computed(() => this.waypoints().length >= 2);
  readonly hasPendingBorder = computed(() => hasPendingBorderCheckpoint(this.waypoints()));
  readonly lang = computed<FreightLang>(() => {
    const current = this.translate.currentLang || this.translate.getDefaultLang() || 'uk';
    return (['uk', 'ru', 'en'].includes(current) ? current : 'uk') as FreightLang;
  });

  private readonly hereApiKey = this.config.config.hereApiKey || this.config.environment.hereApiKey || '';
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private routeLayer: L.Polyline | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private resizeTimers: ReturnType<typeof setTimeout>[] = [];

  constructor() {
    effect(() => {
      const points = this.waypoints();
      const selectedIndex = this.selectedWaypointIndex();
      this.rebuildMarkers(points, selectedIndex);
    });
  }

  ngAfterViewInit(): void {
    this.initializeMapWhenContainerReady();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.resizeTimers.forEach((timer) => clearTimeout(timer));
    this.map?.remove();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.scheduleMapResizeFix();
  }

  async onMapClick(event: L.LeafletMouseEvent): Promise<void> {
    await this.addWaypoint(event.latlng.lat, event.latlng.lng);
  }

  selectWaypoint(index: number): void {
    const point = this.waypoints()[index];
    if (!point || !this.map) {
      return;
    }
    this.selectedWaypointIndex.set(index);
    this.map.flyTo([point.lat, point.lng], Math.max(this.map.getZoom(), 8), {
      animate: true,
      duration: 0.35
    });
  }

  async onSearchChange(value: string): Promise<void> {
    const query = value.trim();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (query.length < 3) {
      this.searchResults.set([]);
      this.highlightedSearchIndex.set(-1);
      return;
    }
    this.isSearching.set(true);
    this.searchDebounceTimer = setTimeout(async () => {
      const items = await this.hereApi.searchAddress(query, this.lang(), this.hereApiKey);
      this.searchResults.set(items);
      this.highlightedSearchIndex.set(items.length > 0 ? 0 : -1);
      this.isSearching.set(false);
    }, 500);
  }

  async selectSearchResult(item: HereGeocodeItem, input: HTMLInputElement): Promise<void> {
    input.value = '';
    this.searchResults.set([]);
    this.highlightedSearchIndex.set(-1);
    await this.addWaypoint(Number(item.lat), Number(item.lon), item.display_name, item.address?.country_code?.toLowerCase() ?? null);
  }

  async removeWaypoint(index: number): Promise<void> {
    this.waypoints.update((items) => items.filter((_, currentIndex) => currentIndex !== index));
    this.selectedWaypointIndex.update((current) => {
      if (current === null) {
        return null;
      }
      if (current === index) {
        return null;
      }
      return current > index ? current - 1 : current;
    });
    await this.recalculateRoute();
  }

  async clearAllPoints(): Promise<void> {
    this.waypoints.set([]);
    this.segmentDistances.set([]);
    this.searchResults.set([]);
    this.selectedWaypointIndex.set(null);
    this.requestOpen.set(false);
    this.selectedCountryBySegment.set({});
    this.borderCheckpointSelectValue.set({});
    this.dropdownSegmentIndex.set(null);
    if (this.routeLayer && this.map) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
  }

  /** Відкриття/закриття панелі вибору КПП для сегмента маршруту */
  onBorderExpansionChange(segmentIndex: number, expanded: boolean): void {
    if (expanded) {
      this.dropdownSegmentIndex.set(segmentIndex);
      return;
    }
    if (this.dropdownSegmentIndex() === segmentIndex) {
      this.dropdownSegmentIndex.set(null);
    }
  }

  /** Вибір країни транзиту в mat-select */
  onBorderCountryMatSelect(segmentIndex: number, value: unknown): void {
    const country = typeof value === 'string' && value.length > 0 ? value : null;
    this.selectedCountryBySegment.update((prev) => ({ ...prev, [segmentIndex]: country }));
    this.borderCheckpointSelectValue.update((m) => ({ ...m, [segmentIndex]: '' }));
  }

  getBorderCheckpointSelectValue(segmentIndex: number): string {
    return this.borderCheckpointSelectValue()[segmentIndex] ?? '';
  }

  /** Вибір КПП у другому mat-select — одразу додає точку на маршрут */
  async onBorderCheckpointMatSelect(segmentIndex: number, value: unknown): Promise<void> {
    const str = value === null || value === undefined ? '' : String(value);
    if (str === '') {
      return;
    }
    const idx = Number(str);
    if (!Number.isInteger(idx) || idx < 0) {
      return;
    }
    await this.addBorderCheckpoint(segmentIndex, idx);
    this.borderCheckpointSelectValue.update((m) => ({ ...m, [segmentIndex]: '' }));
  }

  async addBorderCheckpoint(segmentIndex: number, checkpointIndex: number): Promise<void> {
    const country = this.selectedCountryBySegment()[segmentIndex];
    if (!country) {
      return;
    }
    const checkpoint = CHECKPOINTS_DATA[country]?.[checkpointIndex];
    if (!checkpoint) {
      return;
    }
    const name = checkpoint.name[this.lang()] ?? checkpoint.name.en;
    const next = [...this.waypoints()];
    next.splice(segmentIndex + 1, 0, {
      lat: checkpoint.lat,
      lng: checkpoint.lng,
      address: name,
      country,
      isBorder: true
    });
    this.waypoints.set(next);
    this.selectedWaypointIndex.set(segmentIndex + 1);
    this.dropdownSegmentIndex.set(null);
    await this.recalculateRoute();
  }

  openRequestPage(): void {
    if (!this.hasRoute()) {
      this.showToast('pages.freightCalculation.errors.routeRequired');
      return;
    }
    if (this.hasPendingBorder()) {
      this.showToast('pages.freightCalculation.errors.selectBorderRequired');
      return;
    }
    this.requestOpen.set(true);
  }

  closeRequestPage(): void {
    this.requestOpen.set(false);
  }

  async submitRequest(): Promise<void> {
    const { email, phone } = this.requestForm.getRawValue();
    if (!isValidEmail(email)) {
      this.showToast('pages.freightCalculation.errors.emailRequired');
      return;
    }
    if (!isValidPhone(phone)) {
      this.showToast('pages.freightCalculation.errors.phoneRequired');
      return;
    }
    this.isSubmitting.set(true);
    try {
      await this.requestApi.send(this.createPayload());
      this.requestForm.reset({ email: '', phone: '', preferredStartDate: '', routeComment: '' });
      this.requestOpen.set(false);
      this.showToast('pages.freightCalculation.success');
    } catch {
      this.showToast('pages.freightCalculation.errors.submitFailed');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  getSegmentCountryOptions(): string[] {
    return Object.keys(CHECKPOINTS_DATA);
  }

  getCheckpoints(country: string): Checkpoint[] {
    return CHECKPOINTS_DATA[country] ?? [];
  }

  getCheckpointLocalizedName(checkpoint: Checkpoint): string {
    return checkpoint.name[this.lang()] ?? checkpoint.name.en;
  }

  getPointLabel(index: number): string {
    const points = this.waypoints();
    if (index === 0) {
      return 'pages.freightCalculation.labels.start';
    }
    if (index === points.length - 1) {
      return 'pages.freightCalculation.labels.finish';
    }
    return points[index].isBorder
      ? 'pages.freightCalculation.labels.border'
      : 'pages.freightCalculation.labels.stop';
  }

  async onSearchKeydown(event: KeyboardEvent, input: HTMLInputElement): Promise<void> {
    const items = this.searchResults();
    if (!items.length) {
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedSearchIndex.update((current) => (current + 1) % items.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedSearchIndex.update((current) => (current - 1 + items.length) % items.length);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const selectedIndex = this.highlightedSearchIndex();
      const selected = items[selectedIndex] ?? items[0];
      await this.selectSearchResult(selected, input);
      return;
    }
    if (event.key === 'Escape') {
      this.searchResults.set([]);
      this.highlightedSearchIndex.set(-1);
    }
  }

  private initializeMap(): void {
    const container = this.mapContainer.nativeElement;
    // Висота задається в SCSS (.map); інлайн height:100% ламає Leaflet при height:auto у батька
    container.style.width = '100%';
    container.style.removeProperty('height');
    container.style.removeProperty('min-height');

    const map = L.map(this.mapContainer.nativeElement, { zoomControl: true }).setView([50.4501, 30.5234], 6);
    const hereLayerUrl =
      'https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?style=explore.day&size=256&apiKey=' +
      encodeURIComponent(this.hereApiKey);
    const fallbackLayerUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const tileLayerUrl = this.hereApiKey ? hereLayerUrl : fallbackLayerUrl;
    const attribution = this.hereApiKey
      ? '&copy; HERE'
      : '&copy; OpenStreetMap contributors &copy; CARTO';
    L.tileLayer(tileLayerUrl, { attribution, subdomains: '1234' }).addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => void this.onMapClick(event));
    this.map = map;
    this.rebuildMarkers();
    this.scheduleMapResizeFix();
    requestAnimationFrame(() => {
      this.map?.invalidateSize();
    });
  }

  private initializeMapWhenContainerReady(attempt = 0): void {
    const container = this.mapContainer.nativeElement;
    const hasSize = container.clientWidth > 0 && container.clientHeight > 0;
    if (hasSize) {
      this.initializeMap();
      return;
    }
    if (attempt >= 30) {
      this.initializeMap();
      return;
    }
    const timer = setTimeout(() => {
      this.initializeMapWhenContainerReady(attempt + 1);
    }, 50);
    this.resizeTimers.push(timer);
  }

  private scheduleMapResizeFix(): void {
    this.resizeTimers.forEach((timer) => clearTimeout(timer));
    const delays = [0, 100, 300, 700];
    this.resizeTimers = delays.map((delay) =>
      setTimeout(() => {
        this.map?.invalidateSize();
      }, delay)
    );
  }

  private async addWaypoint(lat: number, lng: number, address?: string, country?: string | null): Promise<void> {
    const fallbackAddress = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const waypointIndex = this.waypoints().length;
    const hasProvidedAddress = Boolean(address);

    this.waypoints.update((items) => {
      const next = [
        ...items,
        {
          lat,
          lng,
          address: address ?? fallbackAddress,
          country: country?.toLowerCase() ?? null,
          isBorder: false
        }
      ];
      this.selectedWaypointIndex.set(next.length - 1);
      return next;
    });

    await this.recalculateRoute();

    if (hasProvidedAddress) {
      return;
    }

    const geocoded = await this.hereApi.reverseGeocode(lat, lng, this.lang(), this.hereApiKey);
    this.waypoints.update((items) =>
      items.map((item, index) =>
        index === waypointIndex
          ? { ...item, address: geocoded.address, country: geocoded.country }
          : item
      )
    );
  }

  private async recalculateRoute(): Promise<void> {
    const points = this.waypoints();
    if (points.length < 2) {
      this.segmentDistances.set([]);
      if (this.routeLayer && this.map) {
        this.map.removeLayer(this.routeLayer);
        this.routeLayer = null;
      }
      return;
    }
    const route = await this.hereApi.fetchRoute(points, this.hereApiKey);
    if (!route || !this.map) {
      this.segmentDistances.set([]);
      return;
    }
    this.segmentDistances.set(route.sections.map((section) => section.summary.length));
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
    }
    const latLngs = route.sections.flatMap((section) => {
      try {
        return decodeHereFlexiblePolyline(section.polyline);
      } catch {
        return [];
      }
    });
    if (!latLngs.length) {
      this.segmentDistances.set([]);
      return;
    }
    this.routeLayer = L.polyline(latLngs, { color: '#2563eb', weight: 5, opacity: 0.7 }).addTo(this.map);
    this.map.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40] });
  }

  private rebuildMarkers(points: Waypoint[] = this.waypoints(), selectedIndex: number | null = this.selectedWaypointIndex()): void {
    if (!this.map) {
      return;
    }
    this.markers.forEach((marker) => marker.remove());
    this.markers = points.map((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        draggable: true,
        icon: this.createWaypointIcon(point, index, index === selectedIndex),
        zIndexOffset: 1000
      }).addTo(this.map!);
      marker.on('click', () => {
        this.selectWaypoint(index);
      });
      marker.on('dragend', async () => {
        const position = marker.getLatLng();
        const geocoded = await this.hereApi.reverseGeocode(position.lat, position.lng, this.lang(), this.hereApiKey);
        this.selectWaypoint(index);
        this.waypoints.update((items) =>
          items.map((item, itemIndex) =>
            itemIndex === index
              ? { ...item, lat: position.lat, lng: position.lng, address: geocoded.address, country: geocoded.country }
              : item
          )
        );
        await this.recalculateRoute();
      });
      return marker;
    });
  }

  private createWaypointIcon(point: Waypoint, index: number, isSelected: boolean): L.DivIcon {
    const label = String(index + 1);
    const backgroundColor = point.isBorder ? '#16a34a' : '#2563eb';
    const borderStyle = isSelected
      ? point.isBorder
        ? 'border: 3px solid #ffffff; box-shadow: 0 0 0 2px rgba(22, 163, 74, 0.35);'
        : 'border: 3px solid #ffffff; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);'
      : 'border: none;';
    return L.divIcon({
      html: `<div style="margin:0;padding:0;border:0;background:transparent;box-shadow:none;"><div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:10px;font-weight:700;box-sizing:border-box;background:${backgroundColor};${borderStyle}">${label}</div></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      className: 'waypoint-icon-shell'
    });
  }


  private createPayload(): FreightRequestPayload {
    const points = this.waypoints();
    const distances = this.segmentDistances();
    const lastIndex = points.length - 1;
    const payloadPoints = points.map((point, index) => ({
      order: index + 1,
      type: (index === 0 ? 'start' : index === lastIndex ? 'finish' : point.isBorder ? 'border' : 'stop') as
        | 'start'
        | 'stop'
        | 'finish'
        | 'border',
      address: point.address,
      lat: Number(point.lat.toFixed(6)),
      lng: Number(point.lng.toFixed(6)),
      country: point.country ?? '',
      isBorder: point.isBorder,
      segmentDistanceKmToNext: index < lastIndex && distances[index] !== undefined ? Number((distances[index] / 1000).toFixed(3)) : null
    }));
    const values = this.requestForm.getRawValue();
    return {
      clientRequestId: (Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).toUpperCase(),
      timestamp: new Date().toISOString(),
      source: 'freight-calculation-web',
      userAgent: navigator.userAgent,
      lang: this.lang(),
      email: values.email,
      phone: values.phone,
      preferredStartDate: values.preferredStartDate || '',
      routeComment: values.routeComment || '',
      distanceKm: Number((this.totalDistanceMeters() / 1000).toFixed(3)),
      points: payloadPoints,
      route: payloadPoints.map((point) => `${point.order}. ${point.address}`).join(' -> ')
    };
  }

  private showToast(key: string): void {
    this.toastMessage.set(key);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }

}

