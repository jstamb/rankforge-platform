/**
 * Cloudflare Integration Service
 * Handles DNS management for custom domains
 */

interface CloudflareZone {
  id: string;
  name: string;
  status: string;
  name_servers: string[];
}

interface CloudflareDNSRecord {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
}

interface CreateDNSRecordParams {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX';
  name: string;
  content: string;
  proxied?: boolean;
  ttl?: number;
}

export class CloudflareService {
  private apiToken: string;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!data.success) {
      const errorMessage = data.errors?.[0]?.message || 'Cloudflare API error';
      throw new Error(errorMessage);
    }

    return data.result;
  }

  /**
   * Verify the API token is valid
   */
  async verifyToken(): Promise<{ id: string; status: string }> {
    return this.request('/user/tokens/verify');
  }

  /**
   * List all zones (domains) in the account
   */
  async listZones(): Promise<CloudflareZone[]> {
    return this.request('/zones');
  }

  /**
   * Get zone details by domain name
   */
  async getZoneByDomain(domain: string): Promise<CloudflareZone | null> {
    const zones = await this.request<CloudflareZone[]>(
      `/zones?name=${encodeURIComponent(domain)}`
    );
    return zones[0] || null;
  }

  /**
   * Get zone by ID
   */
  async getZone(zoneId: string): Promise<CloudflareZone> {
    return this.request(`/zones/${zoneId}`);
  }

  /**
   * List DNS records for a zone
   */
  async listDNSRecords(zoneId: string): Promise<CloudflareDNSRecord[]> {
    return this.request(`/zones/${zoneId}/dns_records`);
  }

  /**
   * Get a specific DNS record
   */
  async getDNSRecord(
    zoneId: string,
    recordId: string
  ): Promise<CloudflareDNSRecord> {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`);
  }

  /**
   * Create a new DNS record
   */
  async createDNSRecord(
    zoneId: string,
    record: CreateDNSRecordParams
  ): Promise<CloudflareDNSRecord> {
    return this.request(`/zones/${zoneId}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: record.type,
        name: record.name,
        content: record.content,
        proxied: record.proxied ?? true,
        ttl: record.ttl ?? 1, // 1 = automatic
      }),
    });
  }

  /**
   * Update an existing DNS record
   */
  async updateDNSRecord(
    zoneId: string,
    recordId: string,
    record: Partial<CreateDNSRecordParams>
  ): Promise<CloudflareDNSRecord> {
    return this.request(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'PATCH',
      body: JSON.stringify(record),
    });
  }

  /**
   * Delete a DNS record
   */
  async deleteDNSRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request(`/zones/${zoneId}/dns_records/${recordId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Set up DNS for a Cloud Run deployment
   * Creates the necessary CNAME record pointing to Cloud Run
   */
  async setupCloudRunDomain(
    zoneId: string,
    subdomain: string,
    cloudRunUrl: string
  ): Promise<CloudflareDNSRecord> {
    // Extract hostname from Cloud Run URL
    const cloudRunHost = new URL(cloudRunUrl).hostname;

    // Check if record already exists
    const records = await this.listDNSRecords(zoneId);
    const existingRecord = records.find(
      (r) => r.name === subdomain && r.type === 'CNAME'
    );

    if (existingRecord) {
      // Update existing record
      return this.updateDNSRecord(zoneId, existingRecord.id, {
        content: cloudRunHost,
        proxied: true,
      });
    }

    // Create new CNAME record
    return this.createDNSRecord(zoneId, {
      type: 'CNAME',
      name: subdomain,
      content: cloudRunHost,
      proxied: true,
    });
  }

  /**
   * Set up SSL configuration for the zone
   */
  async configureSSL(
    zoneId: string,
    mode: 'off' | 'flexible' | 'full' | 'strict' = 'full'
  ): Promise<void> {
    await this.request(`/zones/${zoneId}/settings/ssl`, {
      method: 'PATCH',
      body: JSON.stringify({ value: mode }),
    });
  }

  /**
   * Enable "Always Use HTTPS" for the zone
   */
  async enableAlwaysHTTPS(zoneId: string): Promise<void> {
    await this.request(`/zones/${zoneId}/settings/always_use_https`, {
      method: 'PATCH',
      body: JSON.stringify({ value: 'on' }),
    });
  }

  /**
   * Full domain setup for a new website
   */
  async setupDomainForWebsite(
    domain: string,
    subdomain: string | null,
    cloudRunUrl: string
  ): Promise<{
    zone: CloudflareZone;
    dnsRecord: CloudflareDNSRecord;
  }> {
    // Get zone
    const zone = await this.getZoneByDomain(domain);
    if (!zone) {
      throw new Error(`Domain ${domain} not found in your Cloudflare account`);
    }

    // Set up DNS record
    const recordName = subdomain || '@';
    const dnsRecord = await this.setupCloudRunDomain(
      zone.id,
      recordName,
      cloudRunUrl
    );

    // Configure SSL
    await this.configureSSL(zone.id, 'full');
    await this.enableAlwaysHTTPS(zone.id);

    return { zone, dnsRecord };
  }

  /**
   * Add domain verification TXT record
   */
  async addVerificationRecord(
    zoneId: string,
    verificationToken: string
  ): Promise<CloudflareDNSRecord> {
    return this.createDNSRecord(zoneId, {
      type: 'TXT',
      name: '_rankforge-verify',
      content: verificationToken,
      proxied: false,
    });
  }

  /**
   * Check if domain is properly configured
   */
  async verifyDomainSetup(
    domain: string,
    expectedCloudRunHost: string
  ): Promise<{
    isConfigured: boolean;
    sslEnabled: boolean;
    httpsRedirect: boolean;
  }> {
    const zone = await this.getZoneByDomain(domain);
    if (!zone) {
      return { isConfigured: false, sslEnabled: false, httpsRedirect: false };
    }

    const records = await this.listDNSRecords(zone.id);
    const cnameRecord = records.find(
      (r) =>
        (r.name === domain || r.name === '@') &&
        r.type === 'CNAME' &&
        r.content === expectedCloudRunHost
    );

    // Get SSL settings
    let sslEnabled = false;
    let httpsRedirect = false;

    try {
      const sslSetting = await this.request<{ value: string }>(
        `/zones/${zone.id}/settings/ssl`
      );
      sslEnabled = sslSetting.value !== 'off';

      const httpsSetting = await this.request<{ value: string }>(
        `/zones/${zone.id}/settings/always_use_https`
      );
      httpsRedirect = httpsSetting.value === 'on';
    } catch (e) {
      // Settings might not be accessible
    }

    return {
      isConfigured: !!cnameRecord,
      sslEnabled,
      httpsRedirect,
    };
  }
}
