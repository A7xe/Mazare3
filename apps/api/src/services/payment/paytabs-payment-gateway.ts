import type { PaymentProvider } from '@mazare3/shared';
import type {
  CreatePaymentParams,
  NormalizedGatewayEvent,
  PaymentGateway,
  ProviderIntentResult,
  ProviderPaymentResult,
  RefundPaymentParams,
  RefundPaymentResult,
  RetrievePaymentParams,
  VerifyWebhookParams,
} from './payment-provider.interface.js';
import { ProviderNotConfiguredError } from './provider-not-configured.error.js';
import {
  formatPaytabsAmount,
  parsePaytabsCartId,
  verifyPaytabsCallbackSignature,
} from './paytabs-signature.js';
import {
  assertPaytabsRuntimeSafety,
  loadPaytabsConfig,
  maskPaytabsProfileId,
  redactPaytabsSecrets,
  type PaytabsConfig,
} from '../../config/paytabs-config.js';
import { AppError } from '../../lib/errors.js';
import { buildPayTabsCustomerContact } from '../payment-contact.service.js';

export type PaytabsFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

/**
 * PayTabs Hosted Payment Page adapter for Jordan (Phase 10G.2A).
 * Amounts are always taken from CreatePaymentParams — never recomputed here.
 */
export class PayTabsPaymentGateway implements PaymentGateway {
  readonly provider: PaymentProvider = 'paytabs';

  constructor(
    private readonly http: PaytabsFetch = globalThis.fetch.bind(globalThis) as PaytabsFetch,
    private readonly config: PaytabsConfig = loadPaytabsConfig(),
  ) {
    assertPaytabsRuntimeSafety(this.config);
  }

  async createPayment(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    return this.createIntent(params);
  }

  async createIntent(params: CreatePaymentParams): Promise<ProviderIntentResult> {
    const amount = formatPaytabsAmount(params.amount);
    const body = {
      profile_id: Number(this.config.profileId),
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: params.idempotencyKey,
      cart_currency: this.config.currency,
      cart_amount: amount,
      cart_description:
        params.description?.slice(0, 120) ||
        `Mazare3 ${params.purpose} ${params.paymentId.slice(0, 8)}`,
      paypage_lang: 'ar',
      customer_details: buildPayTabsCustomerDetails(params),
      return: interpolatePaytabsUrl(this.config.returnUrl, params),
      callback: this.config.callbackUrl,
    };

    const json = (await this.postJson('/payment/request', body)) as Record<string, unknown>;
    const tranRef = typeof json.tran_ref === 'string' ? json.tran_ref : null;
    const redirectUrl = typeof json.redirect_url === 'string' ? json.redirect_url : null;
    if (!tranRef || !redirectUrl) {
      throw new Error('PAYTABS_INVALID_RESPONSE: missing tran_ref or redirect_url');
    }

    return {
      provider: this.provider,
      providerRef: tranRef,
      status: 'pending',
      redirectUrl,
    };
  }

  async retrievePayment(params: RetrievePaymentParams): Promise<ProviderPaymentResult> {
    if (!params.providerRef) {
      throw new Error('PAYTABS_MISSING_TRAN_REF');
    }
    const json = (await this.postJson('/payment/query', {
      profile_id: Number(this.config.profileId),
      tran_ref: params.providerRef,
    })) as Record<string, unknown>;

    const status = mapPaytabsPaymentStatus(json);
    const queriedRef = typeof json.tran_ref === 'string' ? json.tran_ref : params.providerRef;
    return {
      provider: this.provider,
      providerRef: queriedRef,
      status,
      providerStatus: extractResponseStatus(json),
      amount: parsePaytabsQueryAmount(json),
      currency: parsePaytabsQueryCurrency(json),
      profileId: parsePaytabsQueryProfileId(json),
    };
  }

  async verifyWebhook(params: VerifyWebhookParams): Promise<NormalizedGatewayEvent | null> {
    const signatureValid = verifyPaytabsCallbackSignature(
      params.rawBody,
      params.signatureHeader,
      this.config.serverKey,
    );
    console.info('[paytabs-webhook]', {
      signatureHeaderPresent: Boolean(params.signatureHeader?.trim()),
      rawBodyLength: Buffer.byteLength(params.rawBody, 'utf8'),
      signatureValid,
      profileMode: this.config.profileMode,
    });
    if (!signatureValid) {
      return null;
    }

    const payload =
      params.payload && typeof params.payload === 'object'
        ? (params.payload as Record<string, unknown>)
        : null;
    if (!payload) return null;

    const tranRef = typeof payload.tran_ref === 'string' ? payload.tran_ref : null;
    const cartId = typeof payload.cart_id === 'string' ? payload.cart_id : null;
    console.info('[paytabs-webhook]', {
      tran_ref: tranRef,
      profile_id_masked: payload.profile_id != null ? maskPaytabsProfileId(String(payload.profile_id)) : null,
      profileMode: this.config.profileMode,
      cart_id: cartId,
    });

    if (payload.profile_id != null && String(payload.profile_id) !== this.config.profileId) {
      return null;
    }
    const parsed = parsePaytabsCartId(cartId);
    if (!tranRef && !parsed) return null;

    const responseStatus = extractResponseStatus(payload);
    if (!responseStatus) return null;

    const type =
      responseStatus === 'A'
        ? 'payment_succeeded'
        : responseStatus === 'H'
          ? null
          : 'payment_failed';
    if (!type) return null;

    const paymentResult = payload.payment_result as Record<string, unknown> | undefined;
    const txnTime =
      typeof paymentResult?.transaction_time === 'string'
        ? paymentResult.transaction_time
        : '';
    const providerEventId = tranRef
      ? `${tranRef}:${responseStatus}:${txnTime || 'na'}`
      : null;

    return {
      type,
      paymentId: parsed?.paymentId ?? null,
      providerPaymentId: tranRef,
      providerEventId,
      raw: params.payload,
    };
  }

  async refundPayment(params: RefundPaymentParams): Promise<RefundPaymentResult> {
    if (!params.providerRef) {
      throw new Error('PAYTABS_MISSING_TRAN_REF');
    }
    const amount = formatPaytabsAmount(params.amount);
    const json = (await this.postJson('/payment/request', {
      profile_id: Number(this.config.profileId),
      tran_type: 'refund',
      tran_class: 'ecom',
      cart_id: params.idempotencyKey,
      cart_currency: params.currency || this.config.currency,
      cart_amount: amount,
      cart_description: `Refund ${params.refundRequestId}`,
      tran_ref: params.providerRef,
    })) as Record<string, unknown>;

    const status = mapPaytabsPaymentStatus(json);
    return {
      providerRef: typeof json.tran_ref === 'string' ? json.tran_ref : params.providerRef,
      status: status === 'pending' ? 'pending' : status === 'succeeded' ? 'succeeded' : 'failed',
      providerStatus: extractResponseStatus(json),
      profileMode: this.config.profileMode,
    };
  }

  /** Exposed for adapter QA — builds the create payload without network I/O. */
  buildSaleRequestBody(params: CreatePaymentParams): Record<string, unknown> {
    const amount = formatPaytabsAmount(params.amount);
    return {
      profile_id: Number(this.config.profileId),
      tran_type: 'sale',
      tran_class: 'ecom',
      cart_id: params.idempotencyKey,
      cart_currency: this.config.currency,
      cart_amount: amount,
      cart_description:
        params.description?.slice(0, 120) ||
        `Mazare3 ${params.purpose} ${params.paymentId.slice(0, 8)}`,
      paypage_lang: 'ar',
      customer_details: buildPayTabsCustomerDetails(params),
      return: interpolatePaytabsUrl(this.config.returnUrl, params),
      callback: this.config.callbackUrl,
    };
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.config.baseUrl.replace(/\/$/, '')}${path}`;
    const res = await this.http(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.config.serverKey,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`PAYTABS_HTTP_${res.status}: invalid JSON`);
    }
    if (!res.ok) {
      throw new Error(
        `PAYTABS_HTTP_${res.status}: ${redactPaytabsSecrets(text.slice(0, 200), this.config.serverKey)}`,
      );
    }
    return json;
  }
}

function parsePaytabsQueryAmount(payload: Record<string, unknown>): number | null {
  const raw = payload.cart_amount ?? payload.tran_total ?? payload.amount;
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parsePaytabsQueryCurrency(payload: Record<string, unknown>): string | null {
  const raw = payload.cart_currency ?? payload.currency;
  return typeof raw === 'string' && raw.trim() ? raw.trim().toUpperCase() : null;
}

function parsePaytabsQueryProfileId(payload: Record<string, unknown>): string | null {
  if (payload.profile_id == null) return null;
  const raw = String(payload.profile_id).trim();
  return raw || null;
}

function extractResponseStatus(payload: Record<string, unknown>): string | null {
  const pr = payload.payment_result as Record<string, unknown> | undefined;
  if (pr && typeof pr.response_status === 'string') return pr.response_status;
  if (typeof payload.respStatus === 'string') return payload.respStatus;
  if (typeof payload.response_status === 'string') return payload.response_status;
  return null;
}

function mapPaytabsPaymentStatus(
  payload: Record<string, unknown>,
): 'pending' | 'succeeded' | 'failed' {
  const s = extractResponseStatus(payload);
  if (s === 'A') return 'succeeded';
  if (s === 'H') return 'pending';
  if (s === 'D' || s === 'E' || s === 'C') return 'failed';
  return 'pending';
}

function interpolatePaytabsUrl(template: string, params: CreatePaymentParams): string {
  return template
    .replaceAll('{bookingId}', params.bookingId)
    .replaceAll('{paymentId}', params.paymentId)
    .replaceAll('{purpose}', params.purpose)
    .replaceAll('{locale}', 'ar');
}

/**
 * UA-5 — Truthful customer_details only. Never fabricates email/phone/name.
 * Jordan HPP address defaults are marketplace defaults, not personal identity.
 */
function buildPayTabsCustomerDetails(params: CreatePaymentParams) {
  const c = params.customer;
  const name = c?.name?.trim() ?? '';
  const email = c?.email?.trim() ?? '';
  const phone = c?.phone?.trim() ?? '';
  const requiredFields: Array<'email' | 'phone' | 'name'> = [];
  if (!name) requiredFields.push('name');
  if (!email) requiredFields.push('email');
  if (!phone) requiredFields.push('phone');
  if (requiredFields.length > 0) {
    throw new AppError(
      422,
      'PAYMENT_CONTACT_REQUIRED',
      'Additional contact details are required to continue to payment',
      { requiredFields },
    );
  }
  return buildPayTabsCustomerContact({ name, email, phone });
}

/** Safe constructor that throws ProviderNotConfiguredError when env is incomplete. */
export function createPayTabsPaymentGateway(
  http?: PaytabsFetch,
  config?: PaytabsConfig,
): PayTabsPaymentGateway {
  try {
    return new PayTabsPaymentGateway(http, config ?? loadPaytabsConfig());
  } catch (err) {
    if (err instanceof ProviderNotConfiguredError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('PROVIDER_NOT_CONFIGURED')) {
      throw new ProviderNotConfiguredError('paytabs');
    }
    throw err;
  }
}
