package com.geosun.tms.freight.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geosun.tms.freight.domain.AiCalculationStatus;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class FreightAiResponseParser {
  private static final Pattern JSON_FENCE =
      Pattern.compile("```(?:json)?\\s*([\\s\\S]*?)```", Pattern.CASE_INSENSITIVE);

  private final ObjectMapper objectMapper;

  public FreightAiResponseParser(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public ParseResult parse(String responseText) {
    if (!StringUtils.hasText(responseText)) {
      return new ParseResult(AiCalculationStatus.FAILED, null, null);
    }
    Optional<JsonNode> structured = tryParseJson(extractJsonCandidate(responseText.trim()));
    if (structured.isPresent()) {
      return new ParseResult(AiCalculationStatus.SUCCESS, responseText, structured.get());
    }
    return new ParseResult(AiCalculationStatus.PARTIAL, responseText, null);
  }

  private static String extractJsonCandidate(String text) {
    Matcher matcher = JSON_FENCE.matcher(text);
    if (matcher.find()) {
      return matcher.group(1).trim();
    }
    return text;
  }

  private Optional<JsonNode> tryParseJson(String candidate) {
    if (!StringUtils.hasText(candidate)) {
      return Optional.empty();
    }
    try {
      JsonNode node = objectMapper.readTree(candidate);
      if (node.isObject() || node.isArray()) {
        return Optional.of(node);
      }
    } catch (Exception ignored) {
      // спробуємо знайти перший JSON-об'єкт у тексті
    }
    int start = candidate.indexOf('{');
    int end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        JsonNode node = objectMapper.readTree(candidate.substring(start, end + 1));
        if (node.isObject() || node.isArray()) {
          return Optional.of(node);
        }
      } catch (Exception ignored) {
        return Optional.empty();
      }
    }
    return Optional.empty();
  }

  public record ParseResult(
      AiCalculationStatus status, String responseText, JsonNode structured) {}
}
