package com.geosun.tms.auth.mail;

import com.geosun.tms.auth.config.AppEmailProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.mail.MailException;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StreamUtils;

/**
 * Відправка листа з токеном верифікації (без логування токена).
 */
@Component
public class VerificationMailSender {
  private static final String TEMPLATE_TOKEN = "{{VERIFICATION_LINK}}";
  private static final String MAIL_SUBJECT =
      "Email verification / Подтверждение email / Підтвердження email";
  private static final Resource PLAIN_TEMPLATE_RESOURCE =
      new ClassPathResource("mail/verification-email.txt");
  private static final Resource HTML_TEMPLATE_RESOURCE =
      new ClassPathResource("mail/verification-email.html");

  private final JavaMailSender mailSender;
  private final AppEmailProperties emailProperties;

  public VerificationMailSender(JavaMailSender mailSender, AppEmailProperties emailProperties) {
    this.mailSender = mailSender;
    this.emailProperties = emailProperties;
  }

  public void sendVerificationEmail(String toAddress, String rawToken) throws MailException {
    String verificationLink = buildVerificationLink(emailProperties.getVerificationLinkBase(), rawToken);
    MimeMessage message = mailSender.createMimeMessage();
    try {
      MimeMessageHelper helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
      helper.setFrom(emailProperties.getFrom());
      helper.setTo(toAddress);
      helper.setSubject(MAIL_SUBJECT);
      helper.setText(buildPlainTextBody(verificationLink), buildHtmlBody(verificationLink));
    } catch (MessagingException | IOException ex) {
      throw new MailPreparationException("Failed to prepare verification email", ex);
    }
    mailSender.send(message);
  }

  private static String buildPlainTextBody(String verificationLink) throws IOException {
    return readTemplate(PLAIN_TEMPLATE_RESOURCE).replace(TEMPLATE_TOKEN, verificationLink);
  }

  private static String buildHtmlBody(String verificationLink) throws IOException {
    return readTemplate(HTML_TEMPLATE_RESOURCE).replace(TEMPLATE_TOKEN, verificationLink);
  }

  private static String readTemplate(Resource resource) throws IOException {
    try (var inputStream = resource.getInputStream()) {
      return StreamUtils.copyToString(inputStream, StandardCharsets.UTF_8);
    }
  }

  private static String buildVerificationLink(String verificationLinkBase, String rawToken) {
    String sanitizedBase =
        verificationLinkBase == null || verificationLinkBase.isBlank()
            ? "http://localhost:4200/verify-email"
            : verificationLinkBase.trim();
    String delimiter = sanitizedBase.contains("?") ? "&" : "?";
    return sanitizedBase
        + delimiter
        + "token="
        + URLEncoder.encode(rawToken, StandardCharsets.UTF_8);
  }
}
