package com.geosun.tms.routes.api;

import com.geosun.tms.auth.config.OpenApiConfig;
import com.geosun.tms.auth.security.UserPrincipal;
import com.geosun.tms.routes.dto.request.SaveRouteRequest;
import com.geosun.tms.routes.dto.response.RouteSnapshotDto;
import com.geosun.tms.routes.dto.response.RouteSummaryDto;
import com.geosun.tms.routes.service.RouteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Routes")
@RestController
@RequestMapping(RoutesApiPaths.ROUTES_BASE)
public class RouteController {
  private final RouteService routeService;

  public RouteController(RouteService routeService) {
    this.routeService = routeService;
  }

  @Operation(summary = "Save route snapshot")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @PostMapping
  public ResponseEntity<RouteSnapshotDto> saveRoute(
      @AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody SaveRouteRequest request) {
    RouteSnapshotDto response = routeService.saveRoute(principal.getUserId(), request);
    return ResponseEntity.status(HttpStatus.CREATED).body(response);
  }

  @Operation(summary = "Get my routes")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping("/my")
  public List<RouteSummaryDto> getMyRoutes(@AuthenticationPrincipal UserPrincipal principal) {
    return routeService.getMyRoutes(principal.getUserId());
  }

  @Operation(summary = "Get my route by id")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping("/my/{routeId}")
  public RouteSnapshotDto getMyRouteById(
      @AuthenticationPrincipal UserPrincipal principal, @PathVariable String routeId) {
    return routeService.getMyRouteById(principal.getUserId(), routeId);
  }

  @Operation(summary = "Soft-delete my route")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @DeleteMapping("/my/{routeId}")
  public ResponseEntity<Void> deleteMyRoute(
      @AuthenticationPrincipal UserPrincipal principal, @PathVariable String routeId) {
    routeService.softDeleteMyRoute(principal.getUserId(), routeId);
    return ResponseEntity.noContent().build();
  }
}

