package com.geosun.tms.auth.mail;

import com.geosun.tms.auth.config.AppEmailProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.mail.MailException;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

/**
 * Відправка листа з посиланням для скидання пароля (без логування токена).
 */
@Component
public class PasswordResetMailSender {
  private static final String TEMPLATE_TOKEN = "{{RESET_LINK}}";
  private static final String MAIL_SUBJECT =
      "Password reset / Сброс пароля / Скидання пароля";
  private static final Resource PLAIN_TEMPLATE_RESOURCE =
      new ClassPathResource("mail/password-reset-email.txt");
  private static final Resource HTML_TEMPLATE_RESOURCE =
      new ClassPathResource("mail/password-reset-email.html");

  private final JavaMailSender mailSender;
  private final AppEmailProperties emailProperties;

  public PasswordResetMailSender(JavaMailSender mailSender, AppEmailProperties emailProperties) {
    this.mailSender = mailSender;
    this.emailProperties = emailProperties;
  }

  public void sendPasswordResetEmail(String toAddress, String rawToken) throws MailException {
    String nonNullToAddress = Objects.requireNonNull(toAddress, "toAddress must not be null");
    String nonNullRawToken = Objects.requireNonNull(rawToken, "rawToken must not be null");
    String nonNullFromAddress =
        Objects.requireNonNull(emailProperties.getFrom(), "from address must not be null");
    String resetLink =
        buildResetLink(emailProperties.resolvePasswordResetLinkBase(), nonNullRawToken);
    MimeMessage message = mailSender.createMimeMessage();
    try {
      MimeMessageHelper helper =
          new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
      helper.setFrom(nonNullFromAddress);
      helper.setTo(nonNullToAddress);
      helper.setSubject(MAIL_SUBJECT);
      helper.setText(
          Objects.requireNonNull(buildPlainTextBody(resetLink)),
          Objects.requireNonNull(buildHtmlBody(resetLink)));
    } catch (MessagingException | IOException ex) {
      throw new MailPreparationException("Failed to prepare password reset email", ex);
    }
    mailSender.send(message);
  }

  private static String buildPlainTextBody(String resetLink) throws IOException {
    return readTemplate(PLAIN_TEMPLATE_RESOURCE).replace(TEMPLATE_TOKEN, resetLink);
  }

  private static String buildHtmlBody(String resetLink) throws IOException {
    return readTemplate(HTML_TEMPLATE_RESOURCE).replace(TEMPLATE_TOKEN, resetLink);
  }

  private static String readTemplate(Resource resource) throws IOException {
    try (var inputStream = resource.getInputStream()) {
      return StreamUtils.copyToString(inputStream, Objects.requireNonNull(StandardCharsets.UTF_8));
    }
  }

  private static String buildResetLink(String resetLinkBase, String rawToken) {
    String sanitizedBase =
        resetLinkBase == null || resetLinkBase.isBlank()
            ? "http://localhost:4200/reset-password"
            : resetLinkBase.trim();
    String delimiter = sanitizedBase.contains("?") ? "&" : "?";
    return sanitizedBase
        + delimiter
        + "token="
        + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
  }
}
