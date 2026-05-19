package com.geosun.tms.freight.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.geosun.tms.auth.exception.ApiException;
import com.geosun.tms.freight.config.VertexAiProperties;
import java.net.URI;
import java.time.Duration;
import java.util.Objects;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class VertexAiClient {
  private final VertexAiProperties properties;
  private final VertexAiCredentialsProvider credentialsProvider;
  private final ObjectMapper objectMapper;
  private final RestTemplate restTemplate;

  public VertexAiClient(
      VertexAiProperties properties,
      VertexAiCredentialsProvider credentialsProvider,
      ObjectMapper objectMapper,
      RestTemplateBuilder restTemplateBuilder) {
    this.properties = properties;
    this.credentialsProvider = credentialsProvider;
    this.objectMapper = objectMapper;
    int timeout = Math.max(1000, properties.timeoutMillis());
    this.restTemplate =
        restTemplateBuilder
            .setConnectTimeout(Duration.ofMillis(timeout))
            .setReadTimeout(Duration.ofMillis(timeout))
            .build();
  }

  public String generate(String systemInstruction, String userContent) {
    validateConfiguration();

    URI uri = buildGenerateContentUri();
    HttpEntity<String> entity = new HttpEntity<>(buildRequestBody(systemInstruction, userContent), authHeaders());

    try {
      ResponseEntity<String> response = restTemplate.postForEntity(uri, entity, String.class);
      return extractText(Objects.requireNonNull(response.getBody(), "empty Vertex AI response"));
    } catch (ResourceAccessException ex) {
      throw ApiException.serviceUnavailable("GEMINI_TIMEOUT", "Vertex AI request timed out");
    } catch (HttpStatusCodeException ex) {
      if (ex.getStatusCode().is5xxServerError()) {
        return retryOnce(uri, entity);
      }
      throw ApiException.serviceUnavailable(
          mapErrorCode(ex.getStatusCode().value()),
          formatErrorMessage(ex.getStatusCode().value(), ex.getResponseBodyAsString()));
    } catch (ApiException ex) {
      throw ex;
    } catch (Exception ex) {
      throw ApiException.serviceUnavailable("GEMINI_UNAVAILABLE", "Vertex AI call failed");
    }
  }

  public String resolvedModelId() {
    return properties.location() + "/" + properties.model();
  }

  private void validateConfiguration() {
    if (!StringUtils.hasText(properties.projectId())) {
      throw ApiException.serviceUnavailable(
          "VERTEX_AI_UNAVAILABLE", "Vertex AI project id is not configured (VERTEX_AI_PROJECT_ID)");
    }
    if (!StringUtils.hasText(properties.location())) {
      throw ApiException.serviceUnavailable(
          "VERTEX_AI_UNAVAILABLE", "Vertex AI location is not configured (VERTEX_AI_LOCATION)");
    }
    if (!StringUtils.hasText(properties.model())) {
      throw ApiException.serviceUnavailable(
          "VERTEX_AI_UNAVAILABLE", "Vertex AI model is not configured (VERTEX_AI_MODEL)");
    }
  }

  private URI buildGenerateContentUri() {
    return UriComponentsBuilder.fromUriString(
            "https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent")
        .buildAndExpand(
            properties.location(),
            properties.projectId(),
            properties.location(),
            properties.model())
        .toUri();
  }

  private HttpHeaders authHeaders() {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentType(MediaType.APPLICATION_JSON);
    headers.setBearerAuth(credentialsProvider.accessToken());
    return headers;
  }

  private String buildRequestBody(String systemInstruction, String userContent) {
    ObjectNode body = objectMapper.createObjectNode();

    ObjectNode system = objectMapper.createObjectNode();
    ArrayNode systemParts = objectMapper.createArrayNode();
    systemParts.addObject().put("text", systemInstruction);
    system.set("parts", systemParts);
    body.set("systemInstruction", system);

    ArrayNode contents = objectMapper.createArrayNode();
    ObjectNode user = objectMapper.createObjectNode();
    user.put("role", "user");
    ArrayNode userParts = objectMapper.createArrayNode();
    userParts.addObject().put("text", userContent);
    user.set("parts", userParts);
    contents.add(user);
    body.set("contents", contents);

    ObjectNode generationConfig = objectMapper.createObjectNode();
    generationConfig.put("maxOutputTokens", properties.maxOutputTokens());
    body.set("generationConfig", generationConfig);

    return body.toString();
  }

  private String retryOnce(@NonNull URI uri, HttpEntity<String> entity) {
    try {
      HttpEntity<String> retryEntity =
          new HttpEntity<>(entity.getBody(), authHeaders());
      ResponseEntity<String> response = restTemplate.postForEntity(uri, retryEntity, String.class);
      return extractText(Objects.requireNonNull(response.getBody(), "empty Vertex AI response"));
    } catch (Exception ex) {
      throw ApiException.serviceUnavailable("GEMINI_UNAVAILABLE", "Vertex AI unavailable after retry");
    }
  }

  private static String mapErrorCode(int httpStatus) {
    if (httpStatus == 403) {
      return "GEMINI_PERMISSION_DENIED";
    }
    if (httpStatus == 404) {
      return "GEMINI_MODEL_NOT_FOUND";
    }
    if (httpStatus == 429) {
      return "GEMINI_QUOTA_EXCEEDED";
    }
    return "GEMINI_UNAVAILABLE";
  }

  private String formatErrorMessage(int httpStatus, String responseBody) {
    String apiMessage = extractApiErrorMessage(responseBody);
    if (apiMessage != null && !apiMessage.isBlank()) {
      return "Vertex AI error " + httpStatus + ": " + apiMessage;
    }
    return "Vertex AI error: " + httpStatus;
  }

  private String extractApiErrorMessage(String responseBody) {
    if (!StringUtils.hasText(responseBody)) {
      return null;
    }
    try {
      JsonNode error = objectMapper.readTree(responseBody).path("error");
      JsonNode message = error.path("message");
      return message.isMissingNode() || message.isNull() ? null : message.asText();
    } catch (Exception ignored) {
      return null;
    }
  }

  private String extractText(String rawJson) throws Exception {
    JsonNode root = objectMapper.readTree(rawJson);
    JsonNode candidates = root.path("candidates");
    if (!candidates.isArray() || candidates.isEmpty()) {
      throw new IllegalStateException("No candidates in Vertex AI response");
    }
    JsonNode parts = candidates.get(0).path("content").path("parts");
    if (!parts.isArray() || parts.isEmpty()) {
      throw new IllegalStateException("No parts in Vertex AI response");
    }
    StringBuilder sb = new StringBuilder();
    for (JsonNode part : parts) {
      if (part.hasNonNull("text")) {
        sb.append(part.get("text").asText());
      }
    }
    if (sb.isEmpty()) {
      throw new IllegalStateException("Empty text in Vertex AI response");
    }
    return sb.toString();
  }
}
