package com.geosun.tms.freight.cost.service;

import com.geosun.tms.routes.domain.Route;
import com.geosun.tms.routes.domain.RoutePoint;
import com.geosun.tms.routes.domain.RoutePointOperation;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class FreightRouteLengthService {
  private static final BigDecimal FALLBACK_EMPTY_RATIO = new BigDecimal("0.15");
  private static final BigDecimal FALLBACK_LOADED_RATIO = new BigDecimal("0.85");

  /** Обчислює L_total, L_empty (до першої LOADING), L_loaded — з fallback 15%/85%. */
  public RouteLengths compute(Route route) {
    BigDecimal totalKm = resolveTotalKm(route);
    List<RoutePoint> points =
        route.getPoints().stream().sorted(Comparator.comparing(RoutePoint::getPointOrder)).toList();

    Integer firstLoadingOrder = findFirstLoadingOrder(points);
    if (firstLoadingOrder == null) {
      BigDecimal emptyKm = totalKm.multiply(FALLBACK_EMPTY_RATIO).setScale(3, RoundingMode.HALF_UP);
      BigDecimal loadedKm =
          totalKm.multiply(FALLBACK_LOADED_RATIO).setScale(3, RoundingMode.HALF_UP);
      return new RouteLengths(totalKm, emptyKm, loadedKm, true);
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
    return new RouteLengths(
        totalKm,
        emptyKm.setScale(3, RoundingMode.HALF_UP),
        loadedKm.setScale(3, RoundingMode.HALF_UP),
        false);
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
}
