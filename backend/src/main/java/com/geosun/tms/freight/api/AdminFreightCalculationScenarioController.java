package com.geosun.tms.freight.api;

import com.geosun.tms.auth.config.OpenApiConfig;
import com.geosun.tms.auth.security.UserPrincipal;
import com.geosun.tms.freight.dto.request.CreateScenarioRequest;
import com.geosun.tms.freight.dto.request.UpdateScenarioRequest;
import com.geosun.tms.freight.dto.response.ScenarioDto;
import com.geosun.tms.freight.service.FreightCalculationScenarioService;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin Freight Calculation Scenarios")
@RestController
@RequestMapping(FreightApiPaths.ADMIN_SCENARIOS_BASE)
@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
public class AdminFreightCalculationScenarioController {
  private final FreightCalculationScenarioService scenarioService;

  public AdminFreightCalculationScenarioController(
      FreightCalculationScenarioService scenarioService) {
    this.scenarioService = scenarioService;
  }

  @Operation(summary = "List freight calculation scenarios")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping
  public List<ScenarioDto> list(
      @RequestParam(name = "activeOnly", defaultValue = "false") boolean activeOnly) {
    return scenarioService.list(activeOnly);
  }

  @Operation(summary = "Get scenario by id")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @GetMapping("/{id}")
  public ScenarioDto getById(@PathVariable String id) {
    return scenarioService.getById(id);
  }

  @Operation(summary = "Create scenario")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @PostMapping
  public ResponseEntity<ScenarioDto> create(
      @AuthenticationPrincipal @NonNull UserPrincipal principal,
      @Valid @RequestBody @NonNull CreateScenarioRequest request) {
    String userId = Objects.requireNonNull(principal.getUserId());
    return ResponseEntity.status(HttpStatus.CREATED).body(scenarioService.create(userId, request));
  }

  @Operation(summary = "Update scenario")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @PutMapping("/{id}")
  public ScenarioDto update(
      @AuthenticationPrincipal @NonNull UserPrincipal principal,
      @PathVariable String id,
      @Valid @RequestBody @NonNull UpdateScenarioRequest request) {
    String userId = Objects.requireNonNull(principal.getUserId());
    return scenarioService.update(userId, id, request);
  }

  @Operation(summary = "Delete or deactivate scenario")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    scenarioService.delete(id);
    return ResponseEntity.noContent().build();
  }

  @Operation(summary = "Import scenario from file")
  @SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
  @PostMapping("/import")
  public ResponseEntity<ScenarioDto> importScenario(
      @AuthenticationPrincipal @NonNull UserPrincipal principal,
      @RequestParam("file") MultipartFile file,
      @RequestParam(name = "name", required = false) String name,
      @RequestParam(name = "description", required = false) String description) {
    String userId = Objects.requireNonNull(principal.getUserId());
    ScenarioDto created = scenarioService.importFromFile(userId, file, name, description);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }
}
