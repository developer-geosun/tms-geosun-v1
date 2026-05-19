package com.geosun.tms.freight.client;

import com.geosun.tms.auth.exception.ApiException;
import com.google.auth.oauth2.GoogleCredentials;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class VertexAiCredentialsProvider {
  private static final List<String> SCOPES =
      List.of("https://www.googleapis.com/auth/cloud-platform");

  public String accessToken() {
    try {
      GoogleCredentials credentials = loadCredentials().createScoped(SCOPES);
      credentials.refreshIfExpired();
      if (credentials.getAccessToken() == null) {
        throw ApiException.serviceUnavailable(
            "VERTEX_AI_UNAVAILABLE", "Vertex AI access token is not available");
      }
      return credentials.getAccessToken().getTokenValue();
    } catch (ApiException ex) {
      throw ex;
    } catch (IOException ex) {
      throw ApiException.serviceUnavailable(
          "VERTEX_AI_UNAVAILABLE", "Vertex AI credentials are not configured: " + ex.getMessage());
    }
  }

  private GoogleCredentials loadCredentials() throws IOException {
    String credentialsPath = System.getenv("GOOGLE_APPLICATION_CREDENTIALS");
    if (StringUtils.hasText(credentialsPath)) {
      Path path = Path.of(credentialsPath);
      if (!Files.isRegularFile(path)) {
        throw ApiException.serviceUnavailable(
            "VERTEX_AI_UNAVAILABLE",
            "GOOGLE_APPLICATION_CREDENTIALS file not found: " + credentialsPath);
      }
      try (InputStream stream = new FileInputStream(path.toFile())) {
        return GoogleCredentials.fromStream(stream);
      }
    }
    return GoogleCredentials.getApplicationDefault();
  }
}
