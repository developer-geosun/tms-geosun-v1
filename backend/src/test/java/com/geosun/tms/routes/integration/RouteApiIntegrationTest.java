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
            .perform(post("/api/v1/routes").header("Authorization", bearer(access)).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Kyiv -> Warsaw"))
            .andExpect(jsonPath("$.points.length()").value(2))
            .andReturn();

    String routeId = objectMapper.readTree(saveResult.getResponse().getContentAsString()).get("id").asText();

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
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(routePayload("Private route"))))
            .andExpect(status().isCreated())
            .andReturn();
    String routeId = objectMapper.readTree(saveResult.getResponse().getContentAsString()).get("id").asText();

    mockMvc
        .perform(get("/api/v1/routes/my/" + routeId).header("Authorization", bearer(intruderAccess)))
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
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(toJson(routePayload("Delete me"))))
            .andExpect(status().isCreated())
            .andReturn();
    String routeId = objectMapper.readTree(saveResult.getResponse().getContentAsString()).get("id").asText();

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
        "phase1",
        "points",
        List.of(startPoint, finishPoint),
        "hereRouteMeta",
        Map.of("provider", "HERE", "routeHandle", "r-handle", "apiVersion", "v8"));
  }

  private String toJson(Object value) throws Exception {
    return objectMapper.writeValueAsString(value);
  }
}

