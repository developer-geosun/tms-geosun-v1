package com.geosun.tms.freight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geosun.tms.auth.domain.user.User;
import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.auth.repository.UserRepository;
import com.geosun.tms.freight.domain.FreightCalculationScenario;
import com.geosun.tms.freight.dto.request.CreateScenarioRequest;
import com.geosun.tms.freight.dto.request.UpdateScenarioRequest;
import com.geosun.tms.freight.dto.response.ScenarioDto;
import com.geosun.tms.freight.repository.FreightAiCalculationRepository;
import com.geosun.tms.freight.repository.FreightCalculationScenarioRepository;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class FreightCalculationScenarioService {
  private static final int MAX_IMPORT_BYTES = 256 * 1024;

  private final FreightCalculationScenarioRepository scenarioRepository;
  private final FreightAiCalculationRepository calculationRepository;
  private final UserRepository userRepository;
  private final ObjectMapper objectMapper;

  public FreightCalculationScenarioService(
      FreightCalculationScenarioRepository scenarioRepository,
      FreightAiCalculationRepository calculationRepository,
      UserRepository userRepository,
      ObjectMapper objectMapper) {
    this.scenarioRepository = scenarioRepository;
    this.calculationRepository = calculationRepository;
    this.userRepository = userRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public List<ScenarioDto> list(boolean activeOnly) {
    List<FreightCalculationScenario> scenarios =
        activeOnly
            ? scenarioRepository.findByActiveTrueOrderByNameAsc()
            : scenarioRepository.findAllByOrderByNameAsc();
    return scenarios.stream().map(this::toDto).toList();
  }

  @Transactional(readOnly = true)
  public ScenarioDto getById(String id) {
    return toDto(loadScenario(id));
  }

  @Transactional
  public ScenarioDto create(String userId, CreateScenarioRequest request) {
    User user = loadUser(userId);
    validateUniqueActiveName(request.name(), null);
    FreightCalculationScenario scenario = new FreightCalculationScenario();
    scenario.setName(request.name().trim());
    scenario.setDescription(request.description());
    scenario.setRulesText(request.rulesText());
    scenario.setOutputFormatHint(request.outputFormatHint());
    scenario.setActive(request.isActive() == null || request.isActive());
    scenario.setCreatedBy(user);
    scenario.setUpdatedBy(user);
    return toDto(scenarioRepository.save(scenario));
  }

  @Transactional
  public ScenarioDto update(String userId, String id, UpdateScenarioRequest request) {
    User user = loadUser(userId);
    FreightCalculationScenario scenario = loadScenario(id);
    validateUniqueActiveName(request.name(), id);
    scenario.setName(request.name().trim());
    scenario.setDescription(request.description());
    scenario.setRulesText(request.rulesText());
    scenario.setOutputFormatHint(request.outputFormatHint());
    scenario.setActive(request.isActive());
    scenario.setUpdatedBy(user);
    return toDto(scenarioRepository.save(scenario));
  }

  @Transactional
  public void delete(String id) {
    FreightCalculationScenario scenario = loadScenario(id);
    if (calculationRepository.existsByScenario_Id(id)) {
      scenario.setActive(false);
      scenarioRepository.save(scenario);
      return;
    }
    scenarioRepository.delete(scenario);
  }

  @Transactional
  public ScenarioDto importFromFile(
      String userId, MultipartFile file, String nameOverride, String descriptionOverride) {
    if (file == null || file.isEmpty()) {
      throw ApiException.badRequest("VALIDATION_ERROR", "File is required");
    }
    if (file.getSize() > MAX_IMPORT_BYTES) {
      throw ApiException.badRequest("VALIDATION_ERROR", "File exceeds 256 KB limit");
    }
    String originalName = Objects.requireNonNullElse(file.getOriginalFilename(), "scenario");
    String extension = extensionOf(originalName);
    if (!List.of("txt", "md", "json").contains(extension)) {
      throw ApiException.badRequest("VALIDATION_ERROR", "Unsupported file type");
    }
    try {
      String content = new String(file.getBytes(), StandardCharsets.UTF_8);
      if ("json".equals(extension)) {
        JsonNode json = objectMapper.readTree(content);
        String name =
            firstNonBlank(
                nameOverride,
                textOrNull(json, "name"),
                stripExtension(sanitizeFilename(originalName)));
        String description = firstNonBlank(descriptionOverride, textOrNull(json, "description"));
        String rulesText = textOrNull(json, "rulesText");
        if (!StringUtils.hasText(rulesText)) {
          throw ApiException.badRequest("VALIDATION_ERROR", "rulesText is required in JSON file");
        }
        String hint = textOrNull(json, "outputFormatHint");
        boolean active = !json.has("isActive") || json.get("isActive").asBoolean(true);
        return create(
            userId, new CreateScenarioRequest(name, description, rulesText, hint, active));
      }
      String name = firstNonBlank(nameOverride, stripExtension(sanitizeFilename(originalName)));
      String description = descriptionOverride;
      return create(userId, new CreateScenarioRequest(name, description, content, "JSON", true));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw ApiException.badRequest("VALIDATION_ERROR", "Failed to parse import file");
    }
  }

  @NonNull
  private FreightCalculationScenario loadScenario(String id) {
    FreightCalculationScenario scenario =
        scenarioRepository
            .findById(Objects.requireNonNull(id, "scenarioId"))
            .orElseThrow(() -> ApiException.notFound("Scenario not found"));
    return Objects.requireNonNull(scenario);
  }

  private User loadUser(String userId) {
    return userRepository
        .findById(Objects.requireNonNull(userId, "userId"))
        .orElseThrow(() -> ApiException.notFound("User not found"));
  }

  private void validateUniqueActiveName(String name, String excludeId) {
    if (!StringUtils.hasText(name)) {
      return;
    }
    boolean exists =
        excludeId == null
            ? scenarioRepository.findByNameIgnoreCaseAndActiveTrue(name.trim()).isPresent()
            : scenarioRepository.existsByNameIgnoreCaseAndActiveTrueAndIdNot(
                name.trim(), excludeId);
    if (exists) {
      throw ApiException.conflict("SCENARIO_NAME_CONFLICT", "Active scenario name already exists");
    }
  }

  private ScenarioDto toDto(FreightCalculationScenario scenario) {
    return new ScenarioDto(
        scenario.getId(),
        scenario.getName(),
        scenario.getDescription(),
        scenario.getRulesText(),
        scenario.getOutputFormatHint(),
        scenario.isActive(),
        scenario.getCreatedAt() == null ? null : scenario.getCreatedAt().toString(),
        scenario.getUpdatedAt() == null ? null : scenario.getUpdatedAt().toString());
  }

  private static String extensionOf(String filename) {
    int dot = filename.lastIndexOf('.');
    if (dot < 0) {
      return "";
    }
    return filename.substring(dot + 1).toLowerCase();
  }

  private static String stripExtension(String name) {
    int dot = name.lastIndexOf('.');
    return dot > 0 ? name.substring(0, dot) : name;
  }

  private static String sanitizeFilename(String name) {
    return name.replaceAll("[^a-zA-Z0-9._-]", "_");
  }

  private static String textOrNull(JsonNode node, String field) {
    JsonNode value = node.get(field);
    return value == null || value.isNull() ? null : value.asText();
  }

  private static String firstNonBlank(String... values) {
    for (String value : values) {
      if (StringUtils.hasText(value)) {
        return value.trim();
      }
    }
    return "Imported scenario";
  }
}
