'use client';

/**
 * CB-4 — PayTabs paylib.js loader + Managed Form mock seam.
 * Real paylib is loaded only on Managed Form Checkout from the configured regional URL.
 */

export type PaylibInlineResponse = {
  error?: { message?: string; code?: string; list?: Array<{ message?: string; messageCode?: string }> };
  token?: string;
  payment_token?: string;
};

export type PaylibApi = {
  inlineForm: (opts: {
    key: string;
    form: HTMLFormElement;
    autoSubmit?: boolean;
    callback: (response: PaylibInlineResponse) => void;
  }) => void;
  handleError?: (el: HTMLElement, response: PaylibInlineResponse) => void;
};

declare global {
  interface Window {
    paylib?: PaylibApi;
    /** E2E seam — forces mock tokenize outcome without real PayTabs. */
    __MAZARE3_MF_TOKENIZE__?:
      | 'ok'
      | 'validation'
      | 'network'
      | 'decline_token'
      | '3ds_token'
      | 'pending_token'
      | 'unknown_token';
  }
}

const PAYLIB_SCRIPT_ATTR = 'data-mazare3-paylib';

export function extractPaylibToken(
  response: PaylibInlineResponse,
  form: HTMLFormElement,
): string | null {
  const fromResponse =
    (typeof response.token === 'string' && response.token.trim()) ||
    (typeof response.payment_token === 'string' && response.payment_token.trim()) ||
    '';
  if (fromResponse) return fromResponse;

  const hidden =
    form.querySelector<HTMLInputElement>('input[name="payment_token"]') ||
    form.querySelector<HTMLInputElement>('input[name="token"]');
  const v = hidden?.value?.trim();
  return v || null;
}

export function mapPaylibErrorToField(
  response: PaylibInlineResponse,
): { field?: 'number' | 'expiry' | 'cvv' | 'form'; messageKey: string } {
  const list = response.error?.list ?? [];
  const blob = [response.error?.message, ...list.map((e) => e.message ?? e.messageCode ?? '')]
    .join(' ')
    .toLowerCase();
  if (blob.includes('cvv') || blob.includes('cvc') || blob.includes('security')) {
    return { field: 'cvv', messageKey: 'cardCvvInvalid' };
  }
  if (blob.includes('exp') || blob.includes('month') || blob.includes('year')) {
    return { field: 'expiry', messageKey: 'cardExpiryInvalid' };
  }
  if (blob.includes('number') || blob.includes('card')) {
    return { field: 'number', messageKey: 'cardNumberInvalid' };
  }
  if (blob.includes('network') || blob.includes('timeout')) {
    return { field: 'form', messageKey: 'cardTokenizeNetwork' };
  }
  return { field: 'form', messageKey: 'cardTokenizeFailed' };
}

/** Install deterministic mock paylib for automated E2E (never talks to PayTabs). */
export function installManagedFormPaylibMock(): PaylibApi {
  const api: PaylibApi = {
    inlineForm({ form, callback }) {
      const prev = (form as HTMLFormElement & { __mazare3PaylibHandler?: (ev: Event) => void })
        .__mazare3PaylibHandler;
      if (prev) form.removeEventListener('submit', prev, true);

      const handler = (ev: Event) => {
        ev.preventDefault();
        ev.stopPropagation();
        const mode = window.__MAZARE3_MF_TOKENIZE__ ?? 'ok';
        if (mode === 'validation') {
          callback({
            error: {
              message: 'Invalid card number',
              list: [{ message: 'card number invalid', messageCode: 'number' }],
            },
          });
          return;
        }
        if (mode === 'network') {
          callback({ error: { message: 'network timeout' } });
          return;
        }
        const tokenMap: Record<string, string> = {
          ok: `mf_ok_${Date.now()}`,
          decline_token: `mf_decline_${Date.now()}`,
          '3ds_token': `mf_3ds_${Date.now()}`,
          pending_token: `mf_pending_${Date.now()}`,
          unknown_token: `mf_unknown_${Date.now()}`,
        };
        const token = tokenMap[mode] ?? `mf_ok_${Date.now()}`;
        let hidden = form.querySelector<HTMLInputElement>('input[name="payment_token"]');
        if (!hidden) {
          hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'payment_token';
          form.appendChild(hidden);
        }
        hidden.value = token;
        callback({ token, payment_token: token });
      };
      (form as HTMLFormElement & { __mazare3PaylibHandler?: (ev: Event) => void }).__mazare3PaylibHandler =
        handler;
      form.addEventListener('submit', handler, true);
    },
  };
  window.paylib = api;
  return api;
}

export function loadPaylibScript(scriptUrl: string): Promise<PaylibApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('paylib is browser-only'));
  }
  if (window.paylib?.inlineForm) {
    return Promise.resolve(window.paylib);
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[${PAYLIB_SCRIPT_ATTR}]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.paylib?.inlineForm) {
        resolve(window.paylib);
        return;
      }
      existing.addEventListener('load', () => {
        if (window.paylib?.inlineForm) resolve(window.paylib);
        else reject(new Error('paylib missing after load'));
      });
      existing.addEventListener('error', () => reject(new Error('paylib script failed')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.setAttribute(PAYLIB_SCRIPT_ATTR, '1');
    script.onload = () => {
      if (window.paylib?.inlineForm) resolve(window.paylib);
      else reject(new Error('paylib missing after load'));
    };
    script.onerror = () => reject(new Error('paylib script failed'));
    document.head.appendChild(script);
  });
}
