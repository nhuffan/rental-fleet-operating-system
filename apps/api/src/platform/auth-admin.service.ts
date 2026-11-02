import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '../config.js';

const unavailable = () =>
  new ServiceUnavailableException({
    code: 'PLATFORM_AUTH_UNAVAILABLE',
    message: 'Owner access is temporarily unavailable',
  });
/** Server-only administrative identity adapter. Never serialize provider errors or links. */
@Injectable()
export class AuthAdminService {
  private client?: SupabaseClient;
  private getClient() {
    if (this.client) return this.client;
    const config = loadConfig(),
      secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw unavailable();
    this.client = createClient(config.supabaseUrl, secret, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal
              ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
              : AbortSignal.timeout(15000),
          }),
      },
    });
    return this.client;
  }
  async createConfirmedUser(email: string): Promise<{ id: string }> {
    try {
      const { data, error } = await this.getClient().auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (error || !data.user) throw unavailable();
      return { id: data.user.id };
    } catch {
      throw unavailable();
    }
  }
  async issueRecoveryToken(email: string): Promise<{ hashedToken: string }> {
    try {
      const { data, error } = await this.getClient().auth.admin.generateLink({
        type: 'recovery',
        email,
      });
      const hashedToken = data?.properties?.hashed_token;
      if (error || !hashedToken || !/^[A-Za-z0-9_-]{20,512}$/.test(hashedToken))
        throw unavailable();
      return { hashedToken };
    } catch {
      throw unavailable();
    }
  }
  async deleteUser(id: string) {
    try {
      const { error } = await this.getClient().auth.admin.deleteUser(id);
      if (error) throw unavailable();
    } catch {
      throw unavailable();
    }
  }
  accessUrl(hashedToken: string, businessId: string) {
    const url = new URL('/auth/confirm', loadConfig().origin);
    url.searchParams.set('token_hash', hashedToken);
    url.searchParams.set('type', 'recovery');
    url.searchParams.set('business', businessId);
    return url.toString();
  }
}
