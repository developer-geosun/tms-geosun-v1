package com.geosun.tms.routes.mail;

import com.geosun.tms.auth.config.AppEmailProperties;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.springframework.mail.MailException;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/** Відправка пропозиції фрахту на email заявника. */
@Component
public class QuoteProposalMailSender {
  private static final String MAIL_SUBJECT = "Пропозиція фрахту / Freight proposal";

  private final JavaMailSender mailSender;
  private final AppEmailProperties emailProperties;

  public QuoteProposalMailSender(JavaMailSender mailSender, AppEmailProperties emailProperties) {
    this.mailSender = mailSender;
    this.emailProperties = emailProperties;
  }

  public void sendProposalEmail(String toAddress, String messageBody) throws MailException {
    if (!StringUtils.hasText(toAddress)) {
      throw new MailPreparationException("Recipient email is empty");
    }
    String body = StringUtils.hasText(messageBody) ? messageBody.trim() : "";
    String from =
        Objects.requireNonNull(emailProperties.getFrom(), "from address must not be null");
    MimeMessage message = mailSender.createMimeMessage();
    try {
      MimeMessageHelper helper =
          new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
      helper.setFrom(from);
      helper.setTo(toAddress.trim());
      helper.setSubject(MAIL_SUBJECT);
      helper.setText(body, false);
    } catch (MessagingException ex) {
      throw new MailPreparationException("Failed to prepare quote proposal email", ex);
    }
    mailSender.send(message);
  }
}
