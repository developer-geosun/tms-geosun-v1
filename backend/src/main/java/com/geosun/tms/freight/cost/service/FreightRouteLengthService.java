package com.geosun.tms.freight.cost.service;

import com.geosun.tms.routes.domain.Route;
import com.geosun.tms.routes.domain.RoutePoint;
import com.geosun.tms.routes.domain.RoutePointOperation;
import com.geosun.tms.routes.service.HereRoutingClient;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;

@Service
public class FreightRouteLengthService {
  private static final BigDecimal FALLBACK_EMPTY_RATIO = new BigDecimal("0.15");
  private static final BigDecimal FALLBACK_LOADED_RATIO = new BigDecimal("0.85");
  private static final BigDecimal METERS_PER_KM = new BigDecimal("1000");
  private final HereRoutingClient hereRoutingClient;

  public FreightRouteLengthService(HereRoutingClient hereRoutingClient) {
    this.hereRoutingClient = hereRoutingClient;
  }

  /** Обчислює L_total, L_empty (до першої LOADING), L_loaded — з fallback 15%/85%. */
  public RouteLengths compute(Route route) {
    return compute(route, null);
  }

  /** Обчислює довжини з урахуванням опційного доїзду до першої точки маршруту. */
  public RouteLengths compute(Route route, StartPoint startPoint) {
    BigDecimal totalKm = resolveTotalKm(route);
    List<RoutePoint> points =
        route.getPoints().stream()
            .sorted(Comparator.comparing((@NonNull RoutePoint point) -> point.getPointOrder()))
            .toList();
    BigDecimal preRouteEmptyKm = resolvePreRouteEmptyKm(startPoint, points);

    Integer firstLoadingOrder = findFirstLoadingOrder(points);
    if (firstLoadingOrder == null) {
      BigDecimal emptyKm =
          totalKm.multiply(FALLBACK_EMPTY_RATIO).setScale(3, RoundingMode.HALF_UP).add(preRouteEmptyKm);
      BigDecimal loadedKm =
          totalKm.multiply(FALLBACK_LOADED_RATIO).setScale(3, RoundingMode.HALF_UP);
      return new RouteLengths(totalKm.add(preRouteEmptyKm), emptyKm, loadedKm, preRouteEmptyKm, true);
    }

    BigDecimal emptyKm = BigDecimal.ZERO;
    BigDecimal loadedKm = BigDecimal.ZERO;
    for (int i = 0; i < points.size(); i++) {
      RoutePoint point = points.get(i);
      BigDecimal segmentKm = point.getSegmentDistanceKmToNext();
      if (segmentKm == null || segmentKm.signum() <= 0) {
        continue;
      }
      int order = point.getPointOrder();
      if (order < firstLoadingOrder) {
        emptyKm = emptyKm.add(segmentKm);
      } else {
        loadedKm = loadedKm.add(segmentKm);
      }
    }
    emptyKm = emptyKm.add(preRouteEmptyKm);
    return new RouteLengths(
        totalKm.add(preRouteEmptyKm),
        emptyKm.setScale(3, RoundingMode.HALF_UP),
        loadedKm.setScale(3, RoundingMode.HALF_UP),
        preRouteEmptyKm,
        false);
  }

  private BigDecimal resolvePreRouteEmptyKm(StartPoint startPoint, List<RoutePoint> sortedRoutePoints) {
    if (startPoint == null || sortedRoutePoints.isEmpty()) {
      return BigDecimal.ZERO;
    }
    RoutePoint firstPoint = sortedRoutePoints.get(0);
    long meters =
        hereRoutingClient.fetchDistanceMeters(
            startPoint.lat(),
            startPoint.lng(),
            firstPoint.getLat().doubleValue(),
            firstPoint.getLng().doubleValue());
    return BigDecimal.valueOf(meters).divide(METERS_PER_KM, 3, RoundingMode.HALF_UP);
  }

  private static BigDecimal resolveTotalKm(Route route) {
    if (route.getDistanceKm() != null && route.getDistanceKm().signum() > 0) {
      return route.getDistanceKm().setScale(3, RoundingMode.HALF_UP);
    }
    BigDecimal sum = BigDecimal.ZERO;
    for (RoutePoint point : route.getPoints()) {
      if (point.getSegmentDistanceKmToNext() != null) {
        sum = sum.add(point.getSegmentDistanceKmToNext());
      }
    }
    return sum.setScale(3, RoundingMode.HALF_UP);
  }

  private static Integer findFirstLoadingOrder(List<RoutePoint> points) {
    for (RoutePoint point : points) {
      if (point.getOperations() != null
          && point.getOperations().contains(RoutePointOperation.LOADING)) {
        return point.getPointOrder();
      }
    }
    return null;
  }

  public record StartPoint(double lat, double lng, String address) {}
}
