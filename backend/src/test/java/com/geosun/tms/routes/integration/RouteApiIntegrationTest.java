package com.geosun.tms.routes.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import java.util.Objects;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
class RouteApiIntegrationTest {
  @Autowired private MockMvc mockMvc;
  @Autowired private ObjectMapper objectMapper;
  @Autowired private UserRepository userRepository;
  @Autowired private PasswordEncoder passwordEncoder;

  @Test
  void saveAndReadMyRoute_success() throws Exception {
    User user = createUser("routes-owner@example.com", "Secret123");
    String access = login(user.getEmail(), "Secret123");

    String body = toJson(routePayload("Kyiv -> Warsaw"));
    MvcResult saveResult =
        mockMvc
            .perform(
                post("/api/v1/routes")
                    .header("Authorization", bearer(access))
                    .contentType(jsonMediaType())
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Kyiv -> Warsaw"))
            .andExpect(jsonPath("$.points.length()").value(2))
            .andReturn();

    String routeId =
        objectMapper.readTree(saveResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(get("/api/v1/routes/my").header("Authorization", bearer(access)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(routeId));

    mockMvc
        .perform(get("/api/v1/routes/my/" + routeId).header("Authorization", bearer(access)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(routeId))
        .andExpect(jsonPath("$.points.length()").value(2));
  }

  @Test
  void getRouteOfAnotherUser_returns404() throws Exception {
    User owner = createUser("routes-owner-2@example.com", "Secret123");
    User intruder = createUser("routes-intruder@example.com", "Secret123");
    String ownerAccess = login(owner.getEmail(), "Secret123");
    String intruderAccess = login(intruder.getEmail(), "Secret123");

    MvcResult saveResult =
        mockMvc
            .perform(
                post("/api/v1/routes")
                    .header("Authorization", bearer(ownerAccess))
                    .contentType(jsonMediaType())
                    .content(toJson(routePayload("Private route"))))
            .andExpect(status().isCreated())
            .andReturn();
    String routeId =
        objectMapper.readTree(saveResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(
            get("/api/v1/routes/my/" + routeId).header("Authorization", bearer(intruderAccess)))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"));
  }

  @Test
  void deleteMyRoute_hidesRouteFromList() throws Exception {
    User user = createUser("routes-delete@example.com", "Secret123");
    String access = login(user.getEmail(), "Secret123");

    MvcResult saveResult =
        mockMvc
            .perform(
                post("/api/v1/routes")
                    .header("Authorization", bearer(access))
                    .contentType(jsonMediaType())
                    .content(toJson(routePayload("Delete me"))))
            .andExpect(status().isCreated())
            .andReturn();
    String routeId =
        objectMapper.readTree(saveResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(delete("/api/v1/routes/my/" + routeId).header("Authorization", bearer(access)))
        .andExpect(status().isNoContent());

    mockMvc
        .perform(get("/api/v1/routes/my").header("Authorization", bearer(access)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void routesWithoutToken_returns401() throws Exception {
    mockMvc
        .perform(get("/api/v1/routes/my"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  void saveRouteWithOperations_roundTrip() throws Exception {
    User user = createUser("routes-ops-owner@example.com", "Secret123");
    String access = login(user.getEmail(), "Secret123");

    String body = toJson(routePayloadWithBorderAndCustoms("Kyiv -> EU"));
    MvcResult saveResult =
        mockMvc
            .perform(
                post("/api/v1/routes")
                    .header("Authorization", bearer(access))
                    .contentType(jsonMediaType())
                    .content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.points.length()").value(4))
            .andExpect(jsonPath("$.points[0].operations[0]").value("LOADING"))
            .andExpect(jsonPath("$.points[1].operations[0]").value("EXPORT_CUSTOMS"))
            .andExpect(jsonPath("$.points[3].operations.length()").value(2))
            .andExpect(jsonPath("$.points[3].operations[0]").value("IMPORT_CUSTOMS"))
            .andExpect(jsonPath("$.points[3].operations[1]").value("UNLOADING"))
            .andReturn();

    String routeId =
        objectMapper.readTree(saveResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(get("/api/v1/routes/my/" + routeId).header("Authorization", bearer(access)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.points.length()").value(4))
        .andExpect(jsonPath("$.points[0].operations[0]").value("LOADING"))
        .andExpect(jsonPath("$.points[3].operations[1]").value("UNLOADING"));
  }

  @Test
  void saveRouteWithCustomsButNoBorder_returns400() throws Exception {
    User user = createUser("routes-ops-bad@example.com", "Secret123");
    String access = login(user.getEmail(), "Secret123");

    String body = toJson(routePayloadCustomsWithoutBorder("Bad route"));
    mockMvc
        .perform(
            post("/api/v1/routes")
                .header("Authorization", bearer(access))
                .contentType(jsonMediaType())
                .content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("ROUTE_OPERATIONS_CUSTOMS_WITHOUT_BORDER"));
  }

  @Test
  void saveRouteWithThreeOpsOnSinglePoint_succeeds() throws Exception {
    User user = createUser("routes-ops-three@example.com", "Secret123");
    String access = login(user.getEmail(), "Secret123");

    String body = toJson(routePayloadWithThreeOpsOnExportPoint("Kyiv -> Border"));
    mockMvc
        .perform(
            post("/api/v1/routes")
                .header("Authorization", bearer(access))
                .contentType(jsonMediaType())
                .content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.points[0].operations.length()").value(3));
  }

  private User createUser(String email, String password) {
    User user = new User();
    user.setEmail(email);
    user.setPasswordHash(passwordEncoder.encode(password));
    user.setRole(Role.USER);
    user.setEmailVerified(true);
    user.setActive(true);
    return userRepository.save(user);
  }

  private String login(String email, String password) throws Exception {
    MvcResult loginResult =
        mockMvc
            .perform(
                post("/api/v1/auth/login")
                    .contentType(jsonMediaType())
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
        "phase1",
        "points",
        List.of(startPoint, finishPoint),
        "hereRouteMeta",
        Map.of("provider", "HERE", "routeHandle", "r-handle", "apiVersion", "v8"));
  }

  private Map<String, Object> routePayloadWithBorderAndCustoms(String title) {
    Map<String, Object> start =
        pointWithOps(1, "START", "Kyiv", 50.4501, 30.5234, "UA", false, 120.0, List.of("LOADING"));
    Map<String, Object> exportStop =
        pointWithOps(
            2,
            "STOP",
            "Lviv warehouse",
            49.8397,
            24.0297,
            "UA",
            false,
            80.0,
            List.of("EXPORT_CUSTOMS"));
    Map<String, Object> border =
        pointWithOps(3, "BORDER", "Krakovets", 49.9425, 23.1745, "UA", true, 350.0, List.of());
    Map<String, Object> finish =
        pointWithOps(
            4,
            "FINISH",
            "Warsaw",
            52.2297,
            21.0122,
            "PL",
            false,
            null,
            List.of("IMPORT_CUSTOMS", "UNLOADING"));

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
        "with-customs",
        "points",
        List.of(start, exportStop, border, finish),
        "hereRouteMeta",
        Map.of("provider", "HERE", "routeHandle", "r-handle", "apiVersion", "v8"));
  }

  private Map<String, Object> routePayloadCustomsWithoutBorder(String title) {
    Map<String, Object> start =
        pointWithOps(1, "START", "Kyiv", 50.4501, 30.5234, "UA", false, 100.0, List.of("LOADING"));
    Map<String, Object> bogus =
        pointWithOps(
            2, "STOP", "Phantom customs", 49.0, 24.0, "UA", false, 50.0, List.of("EXPORT_CUSTOMS"));
    Map<String, Object> finish =
        pointWithOps(
            3, "FINISH", "Warsaw", 52.2297, 21.0122, "PL", false, null, List.of("UNLOADING"));

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
        500.0,
        "durationMin",
        500,
        "routeComment",
        "bad-customs",
        "points",
        List.of(start, bogus, finish),
        "hereRouteMeta",
        Map.of("provider", "HERE", "routeHandle", "r-handle", "apiVersion", "v8"));
  }

  private Map<String, Object> routePayloadWithThreeOpsOnExportPoint(String title) {
    Map<String, Object> start =
        pointWithOps(
            1,
            "START",
            "Ternopil",
            49.5535,
            25.5948,
            "UA",
            false,
            60.0,
            List.of("LOADING", "EXPORT_CUSTOMS", "UNLOADING"));
    Map<String, Object> border =
        pointWithOps(2, "BORDER", "Krakovets", 49.9425, 23.1745, "UA", true, 100.0, List.of());
    Map<String, Object> finish =
        pointWithOps(
            3,
            "FINISH",
            "Przemysl",
            49.7833,
            22.7667,
            "PL",
            false,
            null,
            List.of("IMPORT_CUSTOMS", "UNLOADING"));

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
        180.0,
        "durationMin",
        220,
        "routeComment",
        "three-ops",
        "points",
        List.of(start, border, finish),
        "hereRouteMeta",
        Map.of("provider", "HERE", "routeHandle", "r-handle", "apiVersion", "v8"));
  }

  private Map<String, Object> pointWithOps(
      int order,
      String type,
      String address,
      double lat,
      double lng,
      String country,
      boolean isBorder,
      Double segmentDistanceKm,
      List<String> operations) {
    Map<String, Object> point = new HashMap<>();
    point.put("order", order);
    point.put("type", type);
    point.put("address", address);
    point.put("lat", lat);
    point.put("lng", lng);
    point.put("country", country);
    point.put("isBorder", isBorder);
    point.put("segmentDistanceKmToNext", segmentDistanceKm);
    point.put("operations", operations);
    return point;
  }

  private @NonNull String toJson(Object value) throws Exception {
    return Objects.requireNonNull(objectMapper.writeValueAsString(value));
  }

  private static @NonNull MediaType jsonMediaType() {
    return Objects.requireNonNull(MediaType.APPLICATION_JSON);
  }
}
