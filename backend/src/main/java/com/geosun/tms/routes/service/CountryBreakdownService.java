package com.geosun.tms.routes.service;

import com.geosun.tms.routes.config.HereProperties;
import com.geosun.tms.routes.domain.Route;
import com.geosun.tms.routes.domain.RouteCountryDistance;
import com.geosun.tms.routes.domain.RouteGeometryCacheEntry;
import com.geosun.tms.routes.domain.RoutePoint;
import com.geosun.tms.routes.dto.response.CountryDistanceDto;
import com.geosun.tms.routes.repository.RouteCountryDistanceRepository;
import com.geosun.tms.routes.repository.RouteGeometryCacheRepository;
import io.micrometer.core.instrument.MeterRegistry;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class CountryBreakdownService {
  private final RouteCountryDistanceRepository routeCountryDistanceRepository;
  private final RouteGeometryCacheRepository routeGeometryCacheRepository;
  private final HereRoutingClient hereRoutingClient;
  private final HereProperties hereProperties;
  private final MeterRegistry meterRegistry;

  public CountryBreakdownService(
      RouteCountryDistanceRepository routeCountryDistanceRepository,
      RouteGeometryCacheRepository routeGeometryCacheRepository,
      HereRoutingClient hereRoutingClient,
      HereProperties hereProperties,
      MeterRegistry meterRegistry) {
    this.routeCountryDistanceRepository = routeCountryDistanceRepository;
    this.routeGeometryCacheRepository = routeGeometryCacheRepository;
    this.hereRoutingClient = hereRoutingClient;
    this.hereProperties = hereProperties;
    this.meterRegistry = meterRegistry;
  }

  @Transactional
  public List<CountryDistanceDto> getOrCalculate(Route route) {
    List<RouteCountryDistance> existing =
        routeCountryDistanceRepository.findByRouteIdOrderByCountryCodeAsc(route.getId());
    if (!existing.isEmpty()) {
      return toDto(existing);
    }

    List<HereRoutingClient.CountryBreakdownRow> rows = loadFromHereOrFallback(route);
    if (rows.isEmpty()) {
      return List.of();
    }

    routeCountryDistanceRepository.deleteByRouteId(route.getId());
    List<RouteCountryDistance> toSave = new ArrayList<>(rows.size());
    for (HereRoutingClient.CountryBreakdownRow row : rows) {
      RouteCountryDistance distance = new RouteCountryDistance();
      distance.setRoute(route);
      distance.setCountryCode(row.countryCode());
      distance.setDistanceMeters(Math.max(0, row.distanceMeters()));
      distance.setDurationSeconds(row.durationSeconds());
      toSave.add(distance);
    }
    List<RouteCountryDistance> saved = routeCountryDistanceRepository.saveAll(toSave);
    return toDto(saved);
  }

  private List<CountryDistanceDto> toDto(List<RouteCountryDistance> items) {
    return items.stream()
        .sorted(Comparator.comparing(RouteCountryDistance::getCountryCode))
        .map(
            item ->
                new CountryDistanceDto(
                    item.getCountryCode(), item.getDistanceMeters(), item.getDurationSeconds()))
        .toList();
  }

  private List<HereRoutingClient.CountryBreakdownRow> loadFromHereOrFallback(Route route) {
    String cacheKey = buildCacheKey(route);
    try {
      meterRegistry.counter("here.calls.total").increment();
      RouteGeometryCacheEntry cacheEntry =
          routeGeometryCacheRepository
              .findByCacheKeyAndExpiresAtAfter(cacheKey, Instant.now())
              .orElse(null);
      if (cacheEntry != null) {
        meterRegistry.counter("here.cache.hit").increment();
        List<HereRoutingClient.CountryBreakdownRow> cached =
            hereRoutingClient.parseCountryBreakdown(cacheEntry.getResponseJson());
        if (!cached.isEmpty()) {
          return collapseByCountry(cached);
        }
      }

      String raw = hereRoutingClient.fetchCountryBreakdownRaw(route);
      RouteGeometryCacheEntry newEntry = new RouteGeometryCacheEntry();
      newEntry.setCacheKey(cacheKey);
      newEntry.setResponseJson(raw);
      newEntry.setExpiresAt(Instant.now().plusSeconds(Math.max(60, hereProperties.cacheTtlSeconds())));
      routeGeometryCacheRepository.save(newEntry);
      List<HereRoutingClient.CountryBreakdownRow> parsed = hereRoutingClient.parseCountryBreakdown(raw);
      if (!parsed.isEmpty()) {
        return collapseByCountry(parsed);
      }
    } catch (Exception ex) {
      meterRegistry.counter("here.calls.failed").increment();
    }
    return fallbackFromRoute(route);
  }

  private static List<HereRoutingClient.CountryBreakdownRow> collapseByCountry(
      List<HereRoutingClient.CountryBreakdownRow> rows) {
    Map<String, long[]> grouped = new LinkedHashMap<>();
    for (HereRoutingClient.CountryBreakdownRow row : rows) {
      long[] values = grouped.computeIfAbsent(row.countryCode(), key -> new long[] {0, 0});
      values[0] += Math.max(0, row.distanceMeters());
      if (row.durationSeconds() != null) {
        values[1] += Math.max(0, row.durationSeconds());
      }
    }
    return grouped.entrySet().stream()
        .map(
            entry ->
                new HereRoutingClient.CountryBreakdownRow(
                    entry.getKey(), entry.getValue()[0], entry.getValue()[1] > 0 ? entry.getValue()[1] : null))
        .toList();
  }

  private static List<HereRoutingClient.CountryBreakdownRow> fallbackFromRoute(Route route) {
    Map<String, long[]> grouped = new LinkedHashMap<>();
    List<RoutePoint> points =
        route.getPoints().stream().sorted(Comparator.comparing(RoutePoint::getPointOrder)).toList();
    for (int i = 0; i < points.size(); i++) {
      RoutePoint point = points.get(i);
      if (!StringUtils.hasText(point.getCountry())) {
        continue;
      }
      if (point.getSegmentDistanceKmToNext() == null) {
        continue;
      }
      long distanceMeters = Math.max(0L, Math.round(point.getSegmentDistanceKmToNext() * 1000d));
      long[] values = grouped.computeIfAbsent(point.getCountry().toUpperCase(), key -> new long[] {0, 0});
      values[0] += distanceMeters;
    }
    return grouped.entrySet().stream()
        .map(entry -> new HereRoutingClient.CountryBreakdownRow(entry.getKey(), entry.getValue()[0], null))
        .toList();
  }

  private static String buildCacheKey(Route route) {
    String source =
        route.getRoutingProfile()
            + "|"
            + route.getRoutingMode()
            + "|"
            + route.getPoints().stream()
                .sorted(Comparator.comparing(RoutePoint::getPointOrder))
                .map(point -> point.getLat() + "," + point.getLng())
                .reduce((left, right) -> left + ";" + right)
                .orElse("");
    return sha256(source);
  }

  private static String sha256(String value) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hash = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder out = new StringBuilder(hash.length * 2);
      for (byte b : hash) {
        out.append(String.format("%02x", b));
      }
      return out.toString();
    } catch (Exception ex) {
      throw new IllegalStateException("Failed to hash cache key", ex);
    }
  }
}
