import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class PasswordResetMailerService {
  private readonly logger = new Logger(PasswordResetMailerService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendResetLink(email: string, resetUrl: string): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT', '587'));
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('MAIL_FROM', user || 'no-reply@gestorobras.local');

    if (!host || !user || !pass) {
      this.logger.warn(`SMTP no configurado. Link de recuperacion para ${email}: ${resetUrl}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: 'Recuperacion de contrasena - GestorObras',
      text: `Recibimos una solicitud para restablecer tu contrasena. Usa este enlace: ${resetUrl}`,
      html: `<p>Recibimos una solicitud para restablecer tu contrasena.</p><p><a href="${resetUrl}">Restablecer contrasena</a></p><p>Si no fuiste tu, ignora este mensaje.</p>`,
    });
  }
}
