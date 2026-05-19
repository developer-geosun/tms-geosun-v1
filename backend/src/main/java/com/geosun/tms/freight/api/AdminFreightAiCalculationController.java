package com.geosun.tms.freight.api;

import com.geosun.tms.auth.config.OpenApiConfig;
import com.geosun.tms.auth.security.UserPrincipal;
import com.geosun.tms.freight.dto.request.RunAiCalculationRequest;
import com.geosun.tms.freight.dto.response.FreightAiCalculationDto;
import com.geosun.tms.freight.dto.response.FreightAiCalculationSummaryDto;
import com.geosun.tms.freight.service.FreightAiCalculationService;
import com.geosun.tms.routes.api.RoutesApiPaths;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Admin Freight AI Calculations")
@RestController
@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
public class AdminFreightAiCalculationController {
  private final FreightAiCalculationService calculationService;

  public AdminFreightAiCalculationController(FreightAiCalculationService calculationService) {
    this.calculationService = calculationService;
  }

  @Operation(summary = "Run AI freight calculation for route request")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @PostMapping(RoutesApiPaths.ADMIN_ROUTE_REQUESTS_BASE + "/{requestId}/ai-calculations")
  public ResponseEntity<FreightAiCalculationDto> runCalculation(
      @AuthenticationPrincipal @NonNull UserPrincipal principal,
      @PathVariable Long requestId,
      @Valid @RequestBody @NonNull RunAiCalculationRequest request) {
    String userId = Objects.requireNonNull(principal.getUserId());
    FreightAiCalculationDto result = calculationService.run(userId, requestId, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(result);
  }

  @Operation(summary = "List AI calculation history for route request")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping(RoutesApiPaths.ADMIN_ROUTE_REQUESTS_BASE + "/{requestId}/ai-calculations")
  public List<FreightAiCalculationSummaryDto> listByRequest(@PathVariable Long requestId) {
    return calculationService.listByRequest(requestId);
  }

  @Operation(summary = "Get AI calculation details")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping(FreightApiPaths.ADMIN_AI_CALCULATIONS_BASE + "/{calculationId}")
  public FreightAiCalculationDto getById(@PathVariable String calculationId) {
    return calculationService.getById(calculationId);
  }
}
