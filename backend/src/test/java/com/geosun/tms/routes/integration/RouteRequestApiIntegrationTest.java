package com.geosun.tms.routes.integration;

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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(classes = TmsGeosunBackendJavaApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class RouteRequestApiIntegrationTest {
  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private UserRepository userRepository;
  @Autowired private PasswordEncoder passwordEncoder;

  @Test
  void userCanCreateAndReadOwnRouteRequest() throws Exception {
    User user = createUser("rq-user@example.com", "Secret123", Role.USER);
    String access = login(user.getEmail(), "Secret123");
    String routeId = createRoute(access, "RQ owner route");

    MvcResult requestResult =
        mockMvc
            .perform(
                post("/api/v1/route-requests")
                    .header("Authorization", bearer(access))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        toJson(
                            Map.of(
                                "routeId", routeId,
                                "preferredStartDate", "2026-05-12",
                                "comment", "Need reefer",
                                "cargo", Map.of("type", "food", "weightKg", 18000.0, "volumeM3", 78.0)))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.routeId").value(routeId))
            .andExpect(jsonPath("$.status").value("NEW"))
            .andReturn();

    String requestId = objectMapper.readTree(requestResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(get("/api/v1/route-requests/my").header("Authorization", bearer(access)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(requestId));

    mockMvc
        .perform(get("/api/v1/route-requests/my/" + requestId).header("Authorization", bearer(access)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(requestId))
        .andExpect(jsonPath("$.route.points.length()").value(2));
  }

  @Test
  void userCannotCreateRequestForForeignRoute() throws Exception {
    User owner = createUser("rq-owner@example.com", "Secret123", Role.USER);
    User intruder = createUser("rq-intruder@example.com", "Secret123", Role.USER);
    String ownerAccess = login(owner.getEmail(), "Secret123");
    String intruderAccess = login(intruder.getEmail(), "Secret123");
    String routeId = createRoute(ownerAccess, "Private route");

    Map<String, Object> requestPayload = new HashMap<>();
    requestPayload.put("routeId", routeId);
    requestPayload.put("preferredStartDate", "");
    requestPayload.put("comment", "");
    requestPayload.put("cargo", null);

    mockMvc
        .perform(
            post("/api/v1/route-requests")
                .header("Authorization", bearer(intruderAccess))
                .contentType(MediaType.APPLICATION_JSON)
                .content(toJson(requestPayload)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void adminAndManagerCanReadAdminQueueButUserCannot() throws Exception {
    User user = createUser("rq-user2@example.com", "Secret123", Role.USER);
    User admin = createUser("rq-admin@example.com", "Secret123", Role.ADMIN);
    User manager = createUser("rq-manager@example.com", "Secret123", Role.MANAGER);

    String userAccess = login(user.getEmail(), "Secret123");
    String adminAccess = login(admin.getEmail(), "Secret123");
    String managerAccess = login(manager.getEmail(), "Secret123");

    String routeId = createRoute(userAccess, "Queue route");
    Map<String, Object> requestPayload = new HashMap<>();
    requestPayload.put("routeId", routeId);
    requestPayload.put("preferredStartDate", "");
    requestPayload.put("comment", "q");
    requestPayload.put("cargo", null);

    MvcResult requestResult =
        mockMvc
            .perform(
                post("/api/v1/route-requests")
                    .header("Authorization", bearer(userAccess))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(requestPayload)))
            .andExpect(status().isCreated())
            .andReturn();
    String requestId = objectMapper.readTree(requestResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(get("/api/v1/admin/route-requests").header("Authorization", bearer(adminAccess)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(requestId));

    mockMvc
        .perform(get("/api/v1/admin/route-requests/" + requestId).header("Authorization", bearer(managerAccess)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(requestId));

    mockMvc
        .perform(get("/api/v1/admin/route-requests").header("Authorization", bearer(userAccess)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  private String createRoute(String access, String title) throws Exception {
    MvcResult saveResult =
        mockMvc
            .perform(
                post("/api/v1/routes")
                    .header("Authorization", bearer(access))
                    .contentType(MediaType.APPLICATION_JSON)
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
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(new LoginRequest(email, password))))
            .andExpect(status().isOk())
            .andReturn();
    JsonNode json = objectMapper.readTree(loginResult.getResponse().getContentAsString());
    return json.get("accessToken").asText();
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

    Map<String, Object> finishPoint = new HashMap<>();
    finishPoint.put("order", 2);
    finishPoint.put("type", "FINISH");
    finishPoint.put("address", "Warsaw");
    finishPoint.put("lat", 52.2297);
    finishPoint.put("lng", 21.0122);
    finishPoint.put("country", "PL");
    finishPoint.put("isBorder", false);
    finishPoint.put("segmentDistanceKmToNext", null);

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

  private String toJson(Object value) throws Exception {
    return objectMapper.writeValueAsString(value);
  }
}

