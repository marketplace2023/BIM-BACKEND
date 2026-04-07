import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, Auth } from 'googleapis';

// ─── Helper: perform an authenticated HTTP GET using native fetch ─────────────
async function gbpGet<T>(
  url: string,
  headers: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`GBP API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── In-Memory Token Store (dev/testing only) ────────────────────────────────
// For production, persist tokens in the database (e.g. an oauth_tokens table).
const tokenStore = new Map<string, Auth.Credentials>();

const ACCOUNT_MGMT_BASE =
  'https://mybusinessaccountmanagement.googleapis.com/v1';
const BIZ_INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';

@Injectable()
export class GbpService {
  private readonly logger = new Logger(GbpService.name);

  private readonly scopes = [
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  constructor(private readonly config: ConfigService) {}

  // ─── OAuth helpers ──────────────────────────────────────────────────────────

  private createOAuth2Client(): Auth.OAuth2Client {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>(
      'GBP_REDIRECT_URI',
      'http://localhost:3000/api/gbp/callback',
    );

    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env',
      );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /** Returns the Google consent-screen URL + a random state value. */
  getAuthUrl(): { url: string; state: string } {
    const oauth2Client = this.createOAuth2Client();
    const state = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopes,
      state,
      prompt: 'consent', // forces refresh_token to be returned every time
    });

    return { url, state };
  }

  /** Exchanges the OAuth code for tokens; returns a short session key. */
  async handleCallback(code: string): Promise<string> {
    const oauth2Client = this.createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    const sessionToken = `gbp_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2)}`;

    tokenStore.set(sessionToken, tokens);
    this.logger.log(`GBP session created: ${sessionToken}`);
    return sessionToken;
  }

  // ─── Private: build an authorized axios instance ────────────────────────────

  private async getAuthHeaders(
    sessionToken: string,
  ): Promise<Record<string, string>> {
    const credentials = tokenStore.get(sessionToken);
    if (!credentials) {
      throw new UnauthorizedException(
        'GBP session not found – authenticate via /api/gbp/auth-url first.',
      );
    }

    const oauth2Client = this.createOAuth2Client();
    oauth2Client.setCredentials(credentials);

    // Refresh the access token if it is close to expiry
    const { token } = await oauth2Client.getAccessToken();
    if (!token) {
      throw new UnauthorizedException(
        'Could not obtain a valid GBP access token.',
      );
    }

    // Persist any refreshed credentials
    tokenStore.set(sessionToken, oauth2Client.credentials);

    return { Authorization: `Bearer ${token}` };
  }

  // ─── GBP API: Accounts ──────────────────────────────────────────────────────

  async getAccounts(sessionToken: string): Promise<GbpAccount[]> {
    const headers = await this.getAuthHeaders(sessionToken);
    const data = await gbpGet<{ accounts?: GbpAccount[] }>(
      `${ACCOUNT_MGMT_BASE}/accounts`,
      headers,
    );
    return data.accounts ?? [];
  }

  // ─── GBP API: Locations ─────────────────────────────────────────────────────

  async getLocations(
    sessionToken: string,
    accountName: string, // e.g. "accounts/123456789"
  ): Promise<GbpLocation[]> {
    const headers = await this.getAuthHeaders(sessionToken);

    const readMask = [
      'name',
      'title',
      'storefrontAddress',
      'phoneNumbers',
      'websiteUri',
      'regularHours',
      'categories',
      'metadata',
      'profile',
      'latlng',
    ].join(',');

    const qs = new URLSearchParams({ readMask }).toString();
    const data = await gbpGet<{ locations?: GbpLocation[] }>(
      `${BIZ_INFO_BASE}/${accountName}/locations?${qs}`,
      headers,
    );
    return data.locations ?? [];
  }

  async getLocationDetail(
    sessionToken: string,
    locationName: string, // e.g. "accounts/123/locations/456"
  ): Promise<GbpLocation> {
    const headers = await this.getAuthHeaders(sessionToken);

    const readMask = [
      'name',
      'title',
      'storefrontAddress',
      'phoneNumbers',
      'websiteUri',
      'regularHours',
      'categories',
      'metadata',
      'profile',
      'latlng',
    ].join(',');

    const qs = new URLSearchParams({ readMask }).toString();
    return gbpGet<GbpLocation>(
      `${BIZ_INFO_BASE}/${locationName}?${qs}`,
      headers,
    );
  }

  // ─── GBP API: Reviews ───────────────────────────────────────────────────────
  // Reviews are part of the My Business Business Information API.
  // Endpoint: GET {BIZ_INFO_BASE}/{locationName}/reviews
  // Requires: My Business Business Information API enabled in Cloud Console
  //           + business.manage OAuth scope

  async getReviews(
    sessionToken: string,
    locationName: string, // e.g. "accounts/123/locations/456"
  ): Promise<GbpReview[]> {
    const headers = await this.getAuthHeaders(sessionToken);
    const data = await gbpGet<{ reviews?: GbpReview[] }>(
      `${BIZ_INFO_BASE}/${locationName}/reviews`,
      headers,
    );
    return data.reviews ?? [];
  }

  // ─── Mapper: GBP Location → frontend ListingEntry ──────────────────────────

  mapToListingEntry(location: GbpLocation, vertical: string): ListingEntry {
    const address = location.storefrontAddress
      ? [
          location.storefrontAddress.addressLines?.join(', '),
          location.storefrontAddress.locality,
          location.storefrontAddress.administrativeArea,
        ]
          .filter(Boolean)
          .join(', ')
      : '';

    const phone =
      location.phoneNumbers?.primaryPhone ??
      location.phoneNumbers?.additionalPhones?.[0] ??
      '';

    const rating = location.metadata?.mapsUri ? 0 : 0; // rating comes from reviews aggregate
    const category =
      location.categories?.primaryCategory?.displayName ?? vertical;

    // Derive a URL-friendly id from the last segment of location.name
    const id = location.name.split('/').pop() ?? location.name;

    return {
      id,
      name: location.title,
      subtitle: category,
      description: location.profile?.description ?? '',
      rating,
      reviewCount: 0,
      image: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&name=${id}`,
      badges: ['GOOGLE VERIFIED'],
      address,
      phone,
      distance: '',
      lat: location.latlng?.latitude ?? 0,
      lng: location.latlng?.longitude ?? 0,
      specialties: [category],
      detailBasePath: `/${vertical}`,
    };
  }

  mapReviewsAggregate(reviews: GbpReview[]): {
    rating: number;
    reviewCount: number;
  } {
    if (!reviews.length) return { rating: 0, reviewCount: 0 };

    const starMap: Record<string, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };

    const total = reviews.reduce(
      (sum, r) => sum + (starMap[r.starRating] ?? 0),
      0,
    );

    return {
      rating: Math.round((total / reviews.length) * 10) / 10,
      reviewCount: reviews.length,
    };
  }
}

// ─── GBP API Types ────────────────────────────────────────────────────────────

export interface GbpAccount {
  name: string;
  accountName: string;
  type: string;
  verificationState: string;
  vettedState?: string;
}

export interface GbpLocation {
  name: string;
  title: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  websiteUri?: string;
  regularHours?: {
    periods: Array<{
      openDay: string;
      openTime: string;
      closeDay: string;
      closeTime: string;
    }>;
  };
  categories?: {
    primaryCategory?: { name: string; displayName: string };
    additionalCategories?: Array<{ name: string; displayName: string }>;
  };
  metadata?: {
    mapsUri?: string;
    newReviewUri?: string;
    placeId?: string;
  };
  profile?: {
    description?: string;
  };
  latlng?: {
    latitude: number;
    longitude: number;
  };
}

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: {
    profilePhotoUrl: string;
    displayName: string;
    isAnonymous: boolean;
  };
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

// Mirror of frontend ListingEntry
interface ListingEntry {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  rating: number;
  reviewCount: number;
  image: string;
  badges: string[];
  address: string;
  phone: string;
  distance: string;
  lat: number;
  lng: number;
  specialties: string[];
  detailBasePath: string;
}
