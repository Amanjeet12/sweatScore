import { v } from 'convex/values';

import { internalAction } from '../_generated/server';

// Country code mapping: Region codes -> Endurance Zone accepted values
const COUNTRY_MAPPING: Record<string, string> = {
  US: 'USA',
  GB: 'UK',
  CA: 'Canada',
  MX: 'Mexico',
  AU: 'Australia',
  NZ: 'New Zealand',
  IN: 'India',
  AE: 'UAE',
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  CH: 'Switzerland',
  DE: 'Germany',
  DK: 'Denmark',
  ES: 'Spain',
  FR: 'France',
  IE: 'Ireland',
  IT: 'Italy',
  LU: 'Luxembourg',
  MC: 'Monaco',
  NL: 'Netherlands',
  NO: 'Norway',
  SE: 'Sweden',
  SG: 'Singapore',
  ZA: 'South Africa',
};

/**
 * Map region code to Endurance Zone accepted country value
 * For regions not in the mapping, try to map to broader categories
 */
function mapCountryCode(regionCode: string | null | undefined): string {
  if (!regionCode) return 'UK'; // Default fallback

  const upperRegionCode = regionCode.toUpperCase();

  // Direct mapping
  if (COUNTRY_MAPPING[upperRegionCode]) {
    return COUNTRY_MAPPING[upperRegionCode];
  }

  // European countries not explicitly listed -> map to 'Europe'
  const europeanCountries = [
    'AL',
    'AD',
    'BY',
    'BA',
    'HR',
    'CY',
    'CZ',
    'EE',
    'FI',
    'GR',
    'HU',
    'IS',
    'LV',
    'LI',
    'LT',
    'MK',
    'MT',
    'MD',
    'ME',
    'PL',
    'PT',
    'RO',
    'RU',
    'SM',
    'RS',
    'SK',
    'SI',
    'UA',
    'VA',
  ];
  if (europeanCountries.includes(upperRegionCode)) {
    return 'Europe';
  }

  // African countries not explicitly listed -> map to 'Africa'
  const africanCountries = [
    'DZ',
    'AO',
    'BJ',
    'BW',
    'BF',
    'BI',
    'CM',
    'CV',
    'CF',
    'TD',
    'KM',
    'CG',
    'CD',
    'CI',
    'DJ',
    'EG',
    'GQ',
    'ER',
    'ET',
    'GA',
    'GM',
    'GH',
    'GN',
    'GW',
    'KE',
    'LS',
    'LR',
    'LY',
    'MG',
    'MW',
    'ML',
    'MR',
    'MU',
    'MA',
    'MZ',
    'NA',
    'NE',
    'NG',
    'RW',
    'ST',
    'SN',
    'SC',
    'SL',
    'SO',
    'SS',
    'SD',
    'SZ',
    'TZ',
    'TG',
    'TN',
    'UG',
    'ZM',
    'ZW',
  ];
  if (africanCountries.includes(upperRegionCode)) {
    return 'Africa';
  }

  // Default fallback
  return 'UK';
}

// Type definitions for Endurance Zone API
export interface EnduranceZoneAuthTokenResponse {
  token: string;
}

export interface EnduranceZoneUserUpsertRequest {
  EmailAddress: string;
  PartnerMemberId?: string;
  FirstName: string;
  LastName: string;
  Country: string; // Required
  Level: 'Basic' | 'Basic Plus' | 'Premium' | 'Premium Plus';
  OrgUnitLevels?: string[];
}

export interface EnduranceZoneUserUpsertResponse {
  Identifier: number;
  LoginUrl: string;
  Level: string;
  FirstName: string;
  LastName: string;
  Status: string;
  EmailAddress: string;
  ExternalMemberId: string;
  Action: 'New' | 'Update';
  JoinDate?: string;
  RenewalDate?: string;
  API?: string;
  OrgUnits?: string[] | null;
}

export interface EnduranceZoneErrorResponse {
  error: string;
  message: string;
}

// JWT Token Cache
// Token is valid for 5 minutes, we'll refresh it 30 seconds before expiration
interface TokenCache {
  token: string;
  expiresAt: number; // timestamp in milliseconds
}

let tokenCache: TokenCache | null = null;

/**
 * Get a valid JWT token for Endurance Zone API
 * Automatically refreshes the token if it's expired or about to expire
 *
 * Flow:
 * 1. Call GET /v2/GetAuthToken with apikey header
 * 2. Receive JWT token valid for 5 minutes
 * 3. Use token with Authorization: Bearer header for subsequent calls
 */
async function getAuthToken(apiHost: string, apiKey: string): Promise<string> {
  const now = Date.now();
  const bufferTime = 30 * 1000; // 30 seconds buffer before expiration

  // Check if we have a valid cached token
  if (tokenCache && tokenCache.expiresAt > now + bufferTime) {
    return tokenCache.token;
  }

  // Fetch a new token
  try {
    const response = await fetch(`${apiHost}/v2/GetAuthToken`, {
      method: 'GET',
      headers: {
        apikey: apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get auth token (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as EnduranceZoneAuthTokenResponse;

    // Cache the token with 5 minute expiration
    tokenCache = {
      token: data.token,
      expiresAt: now + 5 * 60 * 1000, // 5 minutes from now
    };

    return data.token;
  } catch (error) {
    console.error('Error getting Endurance Zone auth token:', error);
    throw error;
  }
}

/**
 * Internal action to upsert (Create or Update) a user in Endurance Zone
 * This can only be called from other Convex functions (mutations/actions)
 *
 * HTTP Response Values:
 * 200 - Successful creation or update of a user
 * 400 - The payload sent is not correct or valid
 */
export const upsertUser = internalAction({
  args: {
    emailAddress: v.string(),
    partnerMemberId: v.optional(v.string()),
    firstName: v.string(),
    lastName: v.string(),
    country: v.optional(v.string()),
    level: v.union(
      v.literal('Basic'),
      v.literal('Basic Plus'),
      v.literal('Premium'),
      v.literal('Premium Plus')
    ),
    orgUnitLevels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const apiHost = process.env.ENDURANCE_ZONE_API_HOST;
    const apiKey = process.env.ENDURANCE_ZONE_API_KEY;

    if (!apiHost || !apiKey) {
      throw new Error('Endurance Zone API credentials not configured');
    }

    // Get JWT token (will use cached token if still valid)
    const token = await getAuthToken(apiHost, apiKey);

    const requestBody: EnduranceZoneUserUpsertRequest = {
      EmailAddress: args.emailAddress,
      FirstName: args.firstName,
      LastName: args.lastName,
      Country: mapCountryCode(args.country),
      Level: args.level,
      ...(args.partnerMemberId && { PartnerMemberId: args.partnerMemberId }),
      ...(args.orgUnitLevels && { OrgUnitLevels: args.orgUnitLevels }),
    };

    try {
      const response = await fetch(`${apiHost}/v2/users/upsert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: EnduranceZoneErrorResponse;
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          throw new Error(`Endurance Zone API error (${response.status}): ${errorText}`);
        }

        const errorMessage = errorData.message || errorData.error || errorText;
        throw new Error(`Endurance Zone API error (${response.status}): ${errorMessage}`);
      }

      const data = (await response.json()) as EnduranceZoneUserUpsertResponse;
      return data;
    } catch (error) {
      console.error('Error upserting user to Endurance Zone:', error);
      throw error;
    }
  },
});
