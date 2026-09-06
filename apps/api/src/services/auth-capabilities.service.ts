/**
 * UA-6 — Public auth provider capabilities (no secrets).
 */
import { getSmsOtpProviderName } from '../config/phone-otp-config.js';
import { isPhoneAuthPubliclyAvailable } from '../config/phone-auth-public-config.js';
import { isGoogleAuthConfigured } from '../config/google-auth-config.js';

export type AuthCapabilities = {
  phone: { available: boolean };
  google: { available: boolean };
  emailPassword: { available: true };
};

export function getAuthCapabilities(): AuthCapabilities {
  return {
    phone: { available: isPhoneAuthPubliclyAvailable(getSmsOtpProviderName()) },
    google: { available: isGoogleAuthConfigured() },
    emailPassword: { available: true },
  };
}
