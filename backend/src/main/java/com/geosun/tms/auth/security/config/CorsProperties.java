package com.geosun.tms.auth.security.config;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * CORS: базові локальні origin та динамічні змінні з оточення (NGROK_DOMAIN тощо).
 */
@ConfigurationProperties(prefix = "app.cors")
public class CorsProperties {

  /** Домен без схеми або повний origin (змінна NGROK_DOMAIN). */
  private String ngrokDomain = "";

  /** Додаткові шаблони через кому (змінна CORS_ALLOWED_ORIGIN_PATTERNS). */
  private String allowedOriginPatternsExtra = "";

  public String getNgrokDomain() {
    return ngrokDomain;
  }

  public void setNgrokDomain(String ngrokDomain) {
    this.ngrokDomain = ngrokDomain;
  }

  public String getAllowedOriginPatternsExtra() {
    return allowedOriginPatternsExtra;
  }

  public void setAllowedOriginPatternsExtra(String allowedOriginPatternsExtra) {
    this.allowedOriginPatternsExtra = allowedOriginPatternsExtra;
  }

  /** Повний список allowedOriginPatterns для CorsConfiguration. */
  public List<String> resolveAllowedOriginPatterns() {
    Set<String> patterns = new LinkedHashSet<>();
    patterns.add("http://localhost:4200");
    patterns.add("http://127.0.0.1:4200");
    if (StringUtils.hasText(ngrokDomain)) {
      patterns.add(normalizeToOriginPattern(ngrokDomain.trim()));
    }
    for (String part : splitCommaSeparated(allowedOriginPatternsExtra)) {
      patterns.add(normalizeToOriginPattern(part));
    }
    return new ArrayList<>(patterns);
  }

  private static List<String> splitCommaSeparated(String csv) {
    if (!StringUtils.hasText(csv)) {
      return List.of();
    }
    return Arrays.stream(csv.split(",")).map(String::trim).filter(StringUtils::hasText).toList();
  }

  private static String normalizeToOriginPattern(String value) {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }
    return "https://" + value;
  }
}
