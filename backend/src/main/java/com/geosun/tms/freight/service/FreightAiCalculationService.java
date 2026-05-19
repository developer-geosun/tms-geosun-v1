package com.geosun.tms.freight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geosun.tms.auth.domain.user.User;
import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.auth.repository.UserRepository;
import com.geosun.tms.freight.client.VertexAiClient;
import com.geosun.tms.freight.domain.AiCalculationStatus;
import com.geosun.tms.freight.domain.FreightAiCalculation;
import com.geosun.tms.freight.domain.FreightCalculationScenario;
import com.geosun.tms.freight.dto.request.RunAiCalculationRequest;
import com.geosun.tms.freight.dto.response.FreightAiCalculationDto;
import com.geosun.tms.freight.dto.response.FreightAiCalculationSummaryDto;
import com.geosun.tms.freight.repository.FreightAiCalculationRepository;
import com.geosun.tms.freight.repository.FreightCalculationScenarioRepository;
import com.geosun.tms.routes.domain.RouteRequest;
import com.geosun.tms.routes.repository.RouteRequestRepository;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FreightAiCalculationService {
  private static final Logger log = LoggerFactory.getLogger(FreightAiCalculationService.class);

  private final RouteRequestRepository routeRequestRepository;
  private final FreightCalculationScenarioRepository scenarioRepository;
  private final FreightAiCalculationRepository calculationRepository;
  private final UserRepository userRepository;
  private final VertexAiClient vertexAiClient;
  private final FreightAiPromptBuilder promptBuilder;
  private final FreightAiResponseParser responseParser;
  private final AiRateLimitService rateLimitService;
  private final ObjectMapper objectMapper;

  public FreightAiCalculationService(
      RouteRequestRepository routeRequestRepository,
      FreightCalculationScenarioRepository scenarioRepository,
      FreightAiCalculationRepository calculationRepository,
      UserRepository userRepository,
      VertexAiClient vertexAiClient,
      FreightAiPromptBuilder promptBuilder,
      FreightAiResponseParser responseParser,
      AiRateLimitService rateLimitService,
      ObjectMapper objectMapper) {
    this.routeRequestRepository = routeRequestRepository;
    this.scenarioRepository = scenarioRepository;
    this.calculationRepository = calculationRepository;
    this.userRepository = userRepository;
    this.vertexAiClient = vertexAiClient;
    this.promptBuilder = promptBuilder;
    this.responseParser = responseParser;
    this.rateLimitService = rateLimitService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public FreightAiCalculationDto run(String userId, Long requestId, RunAiCalculationRequest request) {
    rateLimitService.checkAndRecord(userId);
    RouteRequest routeRequest = loadRouteRequest(requestId);
    FreightCalculationScenario scenario = loadActiveScenario(request.scenarioId());
    User user = loadUser(userId);
    LocalDate calculationDate = parseCalculationDate(request.calculationDate());

    String userContent = promptBuilder.buildUserContent(routeRequest, scenario, calculationDate);
    String promptPayload =
        promptBuilder.buildPromptPayloadJson(routeRequest, scenario, calculationDate);

    FreightAiCalculation entity = new FreightAiCalculation();
    entity.setRouteRequest(routeRequest);
    entity.setScenario(scenario);
    entity.setScenarioRulesSnapshot(scenario.getRulesText());
    entity.setModelId(vertexAiClient.resolvedModelId());
    entity.setPromptPayload(promptPayload);
    entity.setCreatedBy(user);

    long started = System.currentTimeMillis();
    log.info("ai_calculation_started requestId={} scenarioId={}", requestId, scenario.getId());
    try {
      String responseText =
          vertexAiClient.generate(promptBuilder.systemInstruction(), userContent);
      FreightAiResponseParser.ParseResult parsed = responseParser.parse(responseText);
      entity.setStatus(parsed.status());
      entity.setResponseText(parsed.responseText());
      if (parsed.structured() != null) {
        entity.setResponseStructured(parsed.structured().toString());
      }
      log.info("ai_calculation_completed requestId={} status={}", requestId, parsed.status());
    } catch (ApiException ex) {
      entity.setStatus(AiCalculationStatus.FAILED);
      entity.setErrorMessage(ex.getMessage());
      entity.setLatencyMs((int) (System.currentTimeMillis() - started));
      calculationRepository.save(entity);
      log.warn("ai_calculation_failed requestId={} code={}", requestId, ex.getCode());
      throw ex;
    } catch (Exception ex) {
      entity.setStatus(AiCalculationStatus.FAILED);
      entity.setErrorMessage("Unexpected calculation error");
      entity.setLatencyMs((int) (System.currentTimeMillis() - started));
      calculationRepository.save(entity);
      log.warn("ai_calculation_failed requestId={}", requestId, ex);
      throw ApiException.serviceUnavailable("GEMINI_UNAVAILABLE", "AI calculation failed");
    }
    entity.setLatencyMs((int) (System.currentTimeMillis() - started));
    FreightAiCalculation saved = calculationRepository.save(entity);
    return toDto(saved);
  }

  @Transactional(readOnly = true)
  public List<FreightAiCalculationSummaryDto> listByRequest(Long requestId) {
    loadRouteRequest(requestId);
    return calculationRepository.findByRouteRequest_IdOrderByCreatedAtDesc(requestId).stream()
        .map(this::toSummaryDto)
        .toList();
  }

  @Transactional(readOnly = true)
  public FreightAiCalculationDto getById(String calculationId) {
    FreightAiCalculation calculation =
        calculationRepository
            .findWithDetailsById(calculationId)
            .orElseThrow(() -> ApiException.notFound("AI calculation not found"));
    return toDto(calculation);
  }

  private RouteRequest loadRouteRequest(Long requestId) {
    return routeRequestRepository
        .findById(Objects.requireNonNull(requestId, "requestId"))
        .orElseThrow(() -> ApiException.notFound("Route request not found"));
  }

  private FreightCalculationScenario loadActiveScenario(String scenarioId) {
    FreightCalculationScenario scenario =
        scenarioRepository
            .findById(Objects.requireNonNull(scenarioId, "scenarioId"))
            .orElseThrow(
                () -> ApiException.badRequest("SCENARIO_NOT_FOUND", "Scenario not found"));
    if (!scenario.isActive()) {
      throw ApiException.badRequest("SCENARIO_NOT_FOUND", "Scenario is not active");
    }
    return scenario;
  }

  private User loadUser(String userId) {
    return userRepository
        .findById(Objects.requireNonNull(userId, "userId"))
        .orElseThrow(() -> ApiException.notFound("User not found"));
  }

  private LocalDate parseCalculationDate(String raw) {
    if (raw == null || raw.isBlank()) {
      return LocalDate.now();
    }
    try {
      return LocalDate.parse(raw);
    } catch (DateTimeParseException ex) {
      throw ApiException.badRequest("VALIDATION_ERROR", "Invalid calculationDate format");
    }
  }

  private FreightAiCalculationDto toDto(FreightAiCalculation entity) {
    JsonNode structured = null;
    if (entity.getResponseStructured() != null) {
      try {
        structured = objectMapper.readTree(entity.getResponseStructured());
      } catch (Exception ignored) {
        structured = null;
      }
    }
    String scenarioName =
        entity.getScenario() == null ? null : entity.getScenario().getName();
    String scenarioId = entity.getScenario() == null ? null : entity.getScenario().getId();
    return new FreightAiCalculationDto(
        entity.getId(),
        entity.getRouteRequest().getId(),
        scenarioId,
        scenarioName,
        entity.getStatus(),
        entity.getResponseText(),
        structured,
        entity.getErrorMessage(),
        entity.getLatencyMs(),
        entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString());
  }

  private FreightAiCalculationSummaryDto toSummaryDto(FreightAiCalculation entity) {
    String scenarioName =
        entity.getScenario() == null ? null : entity.getScenario().getName();
    String scenarioId = entity.getScenario() == null ? null : entity.getScenario().getId();
    return new FreightAiCalculationSummaryDto(
        entity.getId(),
        scenarioId,
        scenarioName,
        entity.getStatus(),
        entity.getCreatedAt() == null ? null : entity.getCreatedAt().toString(),
        entity.getLatencyMs());
  }
}
