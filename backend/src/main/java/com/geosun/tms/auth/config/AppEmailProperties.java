package com.geosun.tms.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * Параметри листів верифікації (app.email.*).
 */
@ConfigurationProperties(prefix = "app.email")
public class AppEmailProperties {

  private static final String DEFAULT_VERIFICATION_LINK_BASE = "http://localhost:4200/verify-email";
  private static final String VERIFY_EMAIL_PATH = "/verify-email";

  private String from = "no-reply@example.com";

  private long verificationExpiresSeconds = 86400;

  /** Fallback, якщо NGROK_DOMAIN порожній (локальна розробка без тунелю). */
  private String verificationLinkBase = DEFAULT_VERIFICATION_LINK_BASE;

  /** Поточний публічний домен (той самий NGROK_DOMAIN, що й для CORS/тунелю). */
  private String ngrokDomain = "";

  public String getFrom() {
    return from;
  }

  public void setFrom(String from) {
    this.from = from;
  }

  public long getVerificationExpiresSeconds() {
    return verificationExpiresSeconds;
  }

  public void setVerificationExpiresSeconds(long verificationExpiresSeconds) {
    this.verificationExpiresSeconds = verificationExpiresSeconds;
  }

  public String getVerificationLinkBase() {
    return verificationLinkBase;
  }

  public void setVerificationLinkBase(String verificationLinkBase) {
    this.verificationLinkBase = verificationLinkBase;
  }

  public String getNgrokDomain() {
    return ngrokDomain;
  }

  public void setNgrokDomain(String ngrokDomain) {
    this.ngrokDomain = ngrokDomain;
  }

  /**
   * База посилання для листа: завжди з NGROK_DOMAIN, якщо задано; інакше EMAIL_VERIFICATION_LINK_BASE.
   */
  public String resolveVerificationLinkBase() {
    if (StringUtils.hasText(ngrokDomain)) {
      return toHttpsOrigin(ngrokDomain.trim()) + VERIFY_EMAIL_PATH;
    }
    if (StringUtils.hasText(verificationLinkBase)) {
      return verificationLinkBase.trim();
    }
    return DEFAULT_VERIFICATION_LINK_BASE;
  }

  private static String toHttpsOrigin(String value) {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      // Прибираємо завершальний слеш, щоб не отримати //verify-email
      return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
    return "https://" + value;
  }
}
