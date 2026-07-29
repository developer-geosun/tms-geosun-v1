package com.geosun.tms.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.util.StringUtils;

/**
 * Параметри листів верифікації та скидання пароля (app.email.*).
 */
@ConfigurationProperties(prefix = "app.email")
public class AppEmailProperties {

  private static final String DEFAULT_VERIFICATION_LINK_BASE = "http://localhost:4200/verify-email";
  private static final String DEFAULT_PASSWORD_RESET_LINK_BASE =
      "http://localhost:4200/reset-password";
  private static final String VERIFY_EMAIL_PATH = "/verify-email";
  private static final String RESET_PASSWORD_PATH = "/reset-password";

  private String from = "no-reply@example.com";

  private long verificationExpiresSeconds = 86400;

  private long passwordResetExpiresSeconds = 3600;

  /** Fallback, якщо NGROK_DOMAIN порожній (локальна розробка без тунелю). */
  private String verificationLinkBase = DEFAULT_VERIFICATION_LINK_BASE;

  /** Fallback для посилання скидання пароля без ngrok. */
  private String passwordResetLinkBase = DEFAULT_PASSWORD_RESET_LINK_BASE;

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

  public long getPasswordResetExpiresSeconds() {
    return passwordResetExpiresSeconds;
  }

  public void setPasswordResetExpiresSeconds(long passwordResetExpiresSeconds) {
    this.passwordResetExpiresSeconds = passwordResetExpiresSeconds;
  }

  public String getVerificationLinkBase() {
    return verificationLinkBase;
  }

  public void setVerificationLinkBase(String verificationLinkBase) {
    this.verificationLinkBase = verificationLinkBase;
  }

  public String getPasswordResetLinkBase() {
    return passwordResetLinkBase;
  }

  public void setPasswordResetLinkBase(String passwordResetLinkBase) {
    this.passwordResetLinkBase = passwordResetLinkBase;
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
    return resolveLinkBase(verificationLinkBase, VERIFY_EMAIL_PATH, DEFAULT_VERIFICATION_LINK_BASE);
  }

  /**
   * База посилання скидання пароля: NGROK_DOMAIN + /reset-password або PASSWORD_RESET_LINK_BASE.
   */
  public String resolvePasswordResetLinkBase() {
    return resolveLinkBase(
        passwordResetLinkBase, RESET_PASSWORD_PATH, DEFAULT_PASSWORD_RESET_LINK_BASE);
  }

  private String resolveLinkBase(String fallbackBase, String path, String defaultBase) {
    if (StringUtils.hasText(ngrokDomain)) {
      return toHttpsOrigin(ngrokDomain.trim()) + path;
    }
    if (StringUtils.hasText(fallbackBase)) {
      return fallbackBase.trim();
    }
    return defaultBase;
  }

  private static String toHttpsOrigin(String value) {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      // Прибираємо завершальний слеш, щоб не отримати //verify-email
      return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
    return "https://" + value;
  }
}
