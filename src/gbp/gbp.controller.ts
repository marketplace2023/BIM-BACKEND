import {
  Controller,
  Get,
  Query,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { GbpService } from './gbp.service';

@Controller('gbp')
export class GbpController {
  private readonly logger = new Logger(GbpController.name);

  constructor(
    private readonly gbpService: GbpService,
    private readonly config: ConfigService,
  ) {}

  // ─── Step 1: Get the Google consent-screen URL ──────────────────────────────
  /**
   * Frontend calls this to obtain the Google OAuth URL.
   * GET /api/gbp/auth-url
   * Response: { url, state }
   */
  @Get('auth-url')
  getAuthUrl() {
    return this.gbpService.getAuthUrl();
  }

  // ─── Step 2: Google redirects here after user grants access ────────────────
  /**
   * Google redirects to this endpoint with ?code=...&state=...
   * Exchanges the code for tokens and redirects the browser to the
   * frontend dashboard with ?gbp_session=<session_token>
   * GET /api/gbp/callback
   */
  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.warn(`GBP OAuth error: ${error}`);
      const frontendUrl = this.config.get<string>(
        'FRONTEND_URL',
        'http://localhost:5173',
      );
      return res.redirect(`${frontendUrl}/auth?gbp_error=${error}`);
    }

    if (!code) {
      throw new BadRequestException('Missing OAuth code parameter.');
    }

    const sessionToken = await this.gbpService.handleCallback(code);
    const frontendUrl = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    // Redirect to the GBP setup wizard so it can auto-detect accounts
    return res.redirect(`${frontendUrl}/gbp-setup?gbp_session=${sessionToken}`);
  }

  // ─── GBP Data Endpoints ─────────────────────────────────────────────────────

  /**
   * List all GBP accounts for the authenticated user.
   * GET /api/gbp/accounts
   * Header: gbp-session: <session_token>
   */
  @Get('accounts')
  @HttpCode(HttpStatus.OK)
  async getAccounts(@Headers('gbp-session') session: string) {
    this.requireSession(session);
    return this.gbpService.getAccounts(session);
  }

  /**
   * List all locations under a GBP account.
   * GET /api/gbp/locations?account=accounts%2F123456789
   * Header: gbp-session: <session_token>
   */
  @Get('locations')
  @HttpCode(HttpStatus.OK)
  async getLocations(
    @Headers('gbp-session') session: string,
    @Query('account') account: string,
  ) {
    this.requireSession(session);
    if (!account)
      throw new BadRequestException('account query param is required');
    return this.gbpService.getLocations(session, account);
  }

  /**
   * Get a single location detail.
   * GET /api/gbp/locations/detail?name=accounts%2F123%2Flocations%2F456
   * Header: gbp-session: <session_token>
   */
  @Get('locations/detail')
  @HttpCode(HttpStatus.OK)
  async getLocationDetail(
    @Headers('gbp-session') session: string,
    @Query('name') name: string,
  ) {
    this.requireSession(session);
    if (!name) throw new BadRequestException('name query param is required');
    return this.gbpService.getLocationDetail(session, name);
  }

  /**
   * Get reviews for a location.
   * GET /api/gbp/reviews?location=accounts%2F123%2Flocations%2F456
   * Header: gbp-session: <session_token>
   */
  @Get('reviews')
  @HttpCode(HttpStatus.OK)
  async getReviews(
    @Headers('gbp-session') session: string,
    @Query('location') location: string,
  ) {
    this.requireSession(session);
    if (!location)
      throw new BadRequestException('location query param is required');
    return this.gbpService.getReviews(session, location);
  }

  /**
   * Convenience endpoint: returns locations mapped to the frontend ListingEntry
   * format so the listing pages can drop in the data directly.
   * GET /api/gbp/listing-entries?account=accounts%2F123&vertical=contratistas
   * Header: gbp-session: <session_token>
   */
  @Get('listing-entries')
  @HttpCode(HttpStatus.OK)
  async getListingEntries(
    @Headers('gbp-session') session: string,
    @Query('account') account: string,
    @Query('vertical') vertical: string,
  ): Promise<unknown[]> {
    this.requireSession(session);
    if (!account)
      throw new BadRequestException('account query param is required');

    const locations = await this.gbpService.getLocations(session, account);

    const entries = await Promise.all(
      locations.map(async (loc) => {
        const entry = this.gbpService.mapToListingEntry(
          loc,
          vertical ?? 'contratistas',
        );

        // Enrich with review aggregate
        try {
          const reviews = await this.gbpService.getReviews(session, loc.name);
          const aggregate = this.gbpService.mapReviewsAggregate(reviews);
          entry.rating = aggregate.rating;
          entry.reviewCount = aggregate.reviewCount;
        } catch {
          // Reviews may not be available for all locations
        }

        return entry;
      }),
    );

    return entries;
  }

  // ─── Health / status ────────────────────────────────────────────────────────

  /** Check if a GBP session is still active (tokens available). */
  @Get('session-status')
  @HttpCode(HttpStatus.OK)
  async sessionStatus(@Headers('gbp-session') session: string) {
    if (!session) return { authenticated: false };
    try {
      await this.gbpService.getAccounts(session);
      return { authenticated: true };
    } catch {
      return { authenticated: false };
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private requireSession(session: string) {
    if (!session) {
      throw new BadRequestException(
        'gbp-session header is required. Connect via /api/gbp/auth-url first.',
      );
    }
  }
}
