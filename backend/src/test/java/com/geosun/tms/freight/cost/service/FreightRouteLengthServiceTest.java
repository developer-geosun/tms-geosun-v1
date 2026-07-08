package com.geosun.tms.freight.cost.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.geosun.tms.routes.domain.Route;
import com.geosun.tms.routes.domain.RoutePoint;
import com.geosun.tms.routes.domain.RoutePointKind;
import com.geosun.tms.routes.domain.RoutePointOperation;
import com.geosun.tms.routes.service.HereRoutingClient;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class FreightRouteLengthServiceTest {
  @Mock private HereRoutingClient hereRoutingClient;

  private FreightRouteLengthService service;

  @BeforeEach
  void setUp() {
    service = new FreightRouteLengthService(hereRoutingClient);
  }

  @Test
  void compute_addsPreRouteDistanceToEmptyAndTotal() {
    Route route = sampleRoute();
    when(hereRoutingClient.fetchDistanceMeters(50.0, 30.0, 49.0, 31.0)).thenReturn(20_000L);

    RouteLengths result =
        service.compute(route, new FreightRouteLengthService.StartPoint(50.0, 30.0, "Depot"));

    assertThat(result.preRouteEmptyKm()).isEqualByComparingTo("20.000");
    assertThat(result.emptyKm()).isEqualByComparingTo("120.000");
    assertThat(result.loadedKm()).isEqualByComparingTo("50.000");
    assertThat(result.totalKm()).isEqualByComparingTo("170.000");
  }

  @Test
  void compute_withoutStartPointKeepsPreviousBehavior() {
    RouteLengths result = service.compute(sampleRoute(), null);

    assertThat(result.preRouteEmptyKm()).isEqualByComparingTo("0.000");
    assertThat(result.emptyKm()).isEqualByComparingTo("100.000");
    assertThat(result.loadedKm()).isEqualByComparingTo("50.000");
    assertThat(result.totalKm()).isEqualByComparingTo("150.000");
  }

  private static Route sampleRoute() {
    Route route = new Route();
    route.setDistanceKm(new BigDecimal("150"));

    RoutePoint p0 = new RoutePoint();
    p0.setPointOrder(0);
    p0.setPointType(RoutePointKind.START);
    p0.setLat(new BigDecimal("49.0"));
    p0.setLng(new BigDecimal("31.0"));
    p0.setSegmentDistanceKmToNext(new BigDecimal("100"));
    p0.setOperations(List.of());

    RoutePoint p1 = new RoutePoint();
    p1.setPointOrder(1);
    p1.setPointType(RoutePointKind.STOP);
    p1.setLat(new BigDecimal("49.5"));
    p1.setLng(new BigDecimal("31.5"));
    p1.setSegmentDistanceKmToNext(new BigDecimal("50"));
    p1.setOperations(List.of(RoutePointOperation.LOADING));

    RoutePoint p2 = new RoutePoint();
    p2.setPointOrder(2);
    p2.setPointType(RoutePointKind.FINISH);
    p2.setLat(new BigDecimal("50.0"));
    p2.setLng(new BigDecimal("32.0"));
    p2.setOperations(List.of(RoutePointOperation.UNLOADING));

    route.setPoints(List.of(p0, p1, p2));
    return route;
  }
}
