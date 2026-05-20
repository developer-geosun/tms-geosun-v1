package com.geosun.tms.freight.integration;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.geosun.tms.auth.TmsGeosunBackendJavaApplication;
import com.geosun.tms.auth.domain.user.Role;
import com.geosun.tms.auth.domain.user.User;
import com.geosun.tms.auth.dto.request.LoginRequest;
import com.geosun.tms.auth.repository.UserRepository;
import com.geosun.tms.freight.client.VertexAiClient;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(classes = TmsGeosunBackendJavaApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class FreightGeminiApiIntegrationTest {
  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private UserRepository userRepository;
  @Autowired private PasswordEncoder passwordEncoder;
  @MockBean private VertexAiClient vertexAiClient;

  @Test
  void adminCanManageScenariosAndRunAiCalculation() throws Exception {
    when(vertexAiClient.generate(anyString(), anyString()))
        .thenReturn("```json\n{\"currency\":\"EUR\",\"total\":4100}\n```");

    User user = createUser("ai-user@example.com", "Secret123", Role.USER);
    User admin = createUser("ai-admin@example.com", "Secret123", Role.ADMIN);
    String userAccess = login(user.getEmail(), "Secret123");
    String adminAccess = login(admin.getEmail(), "Secret123");

    String routeId = createRoute(userAccess, "AI route");
    long requestId = createRouteRequest(userAccess, routeId);

    MvcResult scenarioResult =
        mockMvc
            .perform(
                post("/api/v1/admin/freight-calculation-scenarios")
                    .header("Authorization", bearer(adminAccess))
                    .contentType(jsonContentType())
                    .content(
                        toJson(
                            Map.of(
                                "name",
                                "Test scenario",
                                "description",
                                "desc",
                                "rulesText",
                                "Calculate freight and return JSON",
                                "outputFormatHint",
                                "JSON",
                                "isActive",
                                true))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Test scenario"))
            .andReturn();
    String scenarioId =
        objectMapper.readTree(scenarioResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(
            post("/api/v1/admin/route-requests/" + requestId + "/ai-calculations")
                .header("Authorization", bearer(adminAccess))
                .contentType(jsonContentType())
                .content(toJson(Map.of("scenarioId", scenarioId, "calculationDate", "2026-05-19"))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("SUCCESS"))
        .andExpect(jsonPath("$.responseStructured.total").value(4100));

    mockMvc
        .perform(
            get("/api/v1/admin/route-requests/" + requestId + "/ai-calculations")
                .header("Authorization", bearer(adminAccess)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].scenarioId").value(scenarioId));

    mockMvc
        .perform(
            get("/api/v1/admin/freight-calculation-scenarios")
                .header("Authorization", bearer(userAccess)))
        .andExpect(status().isForbidden());
  }

  private long createRouteRequest(String access, String routeId) throws Exception {
    MvcResult requestResult =
        mockMvc
            .perform(
                post("/api/v1/route-requests")
                    .header("Authorization", bearer(access))
                    .contentType(jsonContentType())
                    .content(
                        toJson(
                            Map.of(
                                "routeId",
                                routeId,
                                "preferredStartDate",
                                "2026-05-12",
                                "comment",
                                "AI test",
                                "cargo",
                                Map.of("type", "food", "weightKg", 1000.0, "volumeM3", 10.0)))))
            .andExpect(status().isCreated())
            .andReturn();
    return objectMapper
        .readTree(requestResult.getResponse().getContentAsString())
        .get("id")
        .asLong();
  }

  private String createRoute(String access, String title) throws Exception {
    MvcResult saveResult =
        mockMvc
            .perform(
                post("/api/v1/routes")
                    .header("Authorization", bearer(access))
                    .contentType(jsonContentType())
                    .content(toJson(routePayload(title))))
            .andExpect(status().isCreated())
            .andReturn();
    JsonNode json = objectMapper.readTree(saveResult.getResponse().getContentAsString());
    return json.get("id").asText();
  }

  private User createUser(String email, String password, Role role) {
    User user = new User();
    user.setEmail(email);
    user.setPasswordHash(passwordEncoder.encode(password));
    user.setRole(role);
    user.setEmailVerified(true);
    user.setActive(true);
    return userRepository.save(user);
  }

  private String login(String email, String password) throws Exception {
    MvcResult loginResult =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(jsonContentType())
                    .content(toJson(new LoginRequest(email, password))))
            .andExpect(status().isOk())
            .andReturn();
    return objectMapper
        .readTree(loginResult.getResponse().getContentAsString())
        .get("accessToken")
        .asText();
  }

  private static String bearer(String access) {
    return "Bearer " + access;
  }

  private Map<String, Object> routePayload(String title) {
    Map<String, Object> startPoint = new HashMap<>();
    startPoint.put("order", 1);
    startPoint.put("type", "START");
    startPoint.put("address", "Kyiv");
    startPoint.put("lat", 50.4501);
    startPoint.put("lng", 30.5234);
    startPoint.put("country", "UA");
    startPoint.put("isBorder", false);
    startPoint.put("segmentDistanceKmToNext", 120.5);
    startPoint.put("operations", List.of("LOADING"));

    Map<String, Object> finishPoint = new HashMap<>();
    finishPoint.put("order", 2);
    finishPoint.put("type", "FINISH");
    finishPoint.put("address", "Warsaw");
    finishPoint.put("lat", 52.2297);
    finishPoint.put("lng", 21.0122);
    finishPoint.put("country", "PL");
    finishPoint.put("isBorder", false);
    finishPoint.put("segmentDistanceKmToNext", null);
    finishPoint.put("operations", List.of("UNLOADING"));

    return Map.of(
        "title",
        title,
        "routingProfile",
        "truck",
        "routingMode",
        "fast",
        "routePolyline",
        "BFoz5xJ67i1B1B7PzIhaxL7Y",
        "distanceKm",
        812.34,
        "durationMin",
        742,
        "routeComment",
        "phase2",
        "points",
        List.of(startPoint, finishPoint),
        "hereRouteMeta",
        Map.of("provider", "HERE", "routeHandle", "r-handle", "apiVersion", "v8"));
  }

  private @NonNull String toJson(Object value) throws Exception {
    return Objects.requireNonNull(objectMapper.writeValueAsString(value));
  }

  private @NonNull MediaType jsonContentType() {
    return Objects.requireNonNull(MediaType.APPLICATION_JSON);
  }
}
