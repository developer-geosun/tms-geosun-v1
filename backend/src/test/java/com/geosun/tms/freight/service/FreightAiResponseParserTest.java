package com.geosun.tms.freight.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.geosun.tms.freight.domain.AiCalculationStatus;
import org.junit.jupiter.api.Test;

class FreightAiResponseParserTest {
  private final FreightAiResponseParser parser = new FreightAiResponseParser(new ObjectMapper());

  @Test
  void parsesJsonFromMarkdownFence() {
    String raw =
        """
        Here is the result:
        ```json
        {"currency":"EUR","total":4200}
        ```
        """;
    FreightAiResponseParser.ParseResult result = parser.parse(raw);
    assertEquals(AiCalculationStatus.SUCCESS, result.status());
    assertNotNull(result.structured());
    assertEquals("EUR", result.structured().get("currency").asText());
  }

  @Test
  void partialWhenJsonInvalid() {
    FreightAiResponseParser.ParseResult result = parser.parse("No structured output here.");
    assertEquals(AiCalculationStatus.PARTIAL, result.status());
  }
}
