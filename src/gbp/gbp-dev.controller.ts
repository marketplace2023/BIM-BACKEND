import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { GbpService } from './gbp.service';

/**
 * Developer-only convenience controller.
 * Helps set up the GBP integration without needing to manually edit .env files.
 *
 * All routes are prefixed: GET/POST /api/gbp/dev/*
 * These endpoints should only be called from localhost during development.
 */
@Controller('gbp/dev')
export class GbpDevController {
  private readonly logger = new Logger(GbpDevController.name);

  constructor(
    private readonly gbpService: GbpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Returns all GBP accounts for the current session in a simple format.
   * GET /api/gbp/dev/accounts
   * Header: gbp-session: <token>
   */
  @Get('accounts')
  @HttpCode(HttpStatus.OK)
  async listAccounts(@Headers('gbp-session') session: string) {
    if (!session) {
      return { ok: false, message: 'No gbp-session header. Connect first.' };
    }

    try {
      const accounts = await this.gbpService.getAccounts(session);
      return {
        ok: true,
        accounts: accounts.map((a) => ({
          name: a.name,
          displayName: a.accountName,
          type: a.type,
        })),
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`GBP getAccounts failed: ${msg}`);

      // Provide a user-friendly diagnosis
      let hint = msg;
      if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
        hint =
          'Error 403: La API "My Business Account Management API" no está habilitada en Google Cloud Console, ' +
          'o la cuenta no tiene perfiles en Google Business Profile. ' +
          'Ve a console.cloud.google.com → APIs y Servicios → Biblioteca → habilita "My Business Account Management API".';
      } else if (msg.includes('401') || msg.includes('UNAUTHENTICATED')) {
        hint =
          'Sesión expirada. Vuelve a /gbp-setup y conecta de nuevo con Google.';
      }

      return { ok: false, message: hint };
    }
  }

  /**
   * Writes VITE_GBP_ACCOUNT_NAME to the frontend .env.local file automatically.
   * POST /api/gbp/dev/save-account
   * Body: { accountName: "accounts/123456789" }
   */
  @Post('save-account')
  @HttpCode(HttpStatus.OK)
  saveAccount(@Body('accountName') accountName: string) {
    if (!accountName) {
      return { ok: false, message: 'accountName is required in request body.' };
    }

    // Resolve path to contractor-frontend/.env.local relative to this backend
    const envLocalPath = path.resolve(
      __dirname,
      '../../../../contractor-frontend/.env.local',
    );

    try {
      let content = '';
      if (fs.existsSync(envLocalPath)) {
        content = fs.readFileSync(envLocalPath, 'utf8');
      }

      if (content.includes('VITE_GBP_ACCOUNT_NAME=')) {
        // Replace existing line
        content = content.replace(
          /^VITE_GBP_ACCOUNT_NAME=.*/m,
          `VITE_GBP_ACCOUNT_NAME=${accountName}`,
        );
      } else {
        // Append new line
        content =
          content.trimEnd() + `\nVITE_GBP_ACCOUNT_NAME=${accountName}\n`;
      }

      fs.writeFileSync(envLocalPath, content, 'utf8');

      this.logger.log(
        `Saved VITE_GBP_ACCOUNT_NAME=${accountName} to ${envLocalPath}`,
      );

      return {
        ok: true,
        message: `✅ Guardado. Reinicia el servidor frontend (npm run dev) para aplicar.`,
        accountName,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `No se pudo escribir el archivo: ${msg}` };
    }
  }
}
