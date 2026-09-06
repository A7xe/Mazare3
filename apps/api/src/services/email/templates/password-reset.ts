import {
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '../../../config/password-reset.js';

export type PasswordResetEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

/**
 * AUTH-2/AUTH-3 password-reset transactional templates (AR/EN).
 * Textual Mazare3 branding — no fragile remote logo dependency.
 */
export function renderPasswordResetEmail(
  locale: string,
  resetUrl: string,
  expiresMinutes: number = Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60_000),
): PasswordResetEmailContent {
  const loc = locale === 'en' ? 'en' : 'ar';
  const href = escapeHtmlAttr(resetUrl);

  if (loc === 'en') {
    const subject = 'Reset your password';
    const text = [
      'Mazare3 Jordan',
      '',
      'Reset your password',
      '',
      'We received a request to reset the password for your Mazare3 account.',
      '',
      `Reset password (expires in ${expiresMinutes} minutes):`,
      resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n');

    const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<body style="margin:0;padding:0;background:#f5f8fc;font-family:Arial,Helvetica,sans-serif;color:#001c55;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f8fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #d8e3f0;">
        <tr><td style="font-size:13px;font-weight:700;color:#0e6ba8;letter-spacing:0.02em;">Mazare3 Jordan</td></tr>
        <tr><td style="padding-top:16px;font-size:22px;font-weight:700;line-height:1.3;">Reset your password</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#334155;">We received a request to reset the password for your Mazare3 account.</td></tr>
        <tr><td style="padding-top:22px;" align="center">
          <a href="${href}" style="display:inline-block;background:#0e6ba8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">Reset password</a>
        </td></tr>
        <tr><td style="padding-top:18px;font-size:13px;line-height:1.5;color:#64748b;">This link expires in ${expiresMinutes} minutes.</td></tr>
        <tr><td style="padding-top:10px;font-size:13px;line-height:1.5;color:#64748b;">If you did not request this, you can ignore this email.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    return { subject, text, html };
  }

  const subject = 'إعادة تعيين كلمة المرور';
  const text = [
    'مزارع الأردن',
    '',
    'إعادة تعيين كلمة المرور',
    '',
    'تلقّينا طلباً لإعادة تعيين كلمة مرور حسابك في مزارع.',
    '',
    `إعادة تعيين كلمة المرور (ينتهي خلال ${expiresMinutes} دقيقة):`,
    resetUrl,
    '',
    'إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<body style="margin:0;padding:0;background:#f5f8fc;font-family:Arial,Helvetica,sans-serif;color:#001c55;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f8fc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #d8e3f0;">
        <tr><td style="font-size:13px;font-weight:700;color:#0e6ba8;">مزارع الأردن</td></tr>
        <tr><td style="padding-top:16px;font-size:22px;font-weight:700;line-height:1.3;">إعادة تعيين كلمة المرور</td></tr>
        <tr><td style="padding-top:12px;font-size:15px;line-height:1.55;color:#334155;">تلقّينا طلباً لإعادة تعيين كلمة مرور حسابك في مزارع.</td></tr>
        <tr><td style="padding-top:22px;" align="center">
          <a href="${href}" style="display:inline-block;background:#0e6ba8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border-radius:10px;">إعادة تعيين كلمة المرور</a>
        </td></tr>
        <tr><td style="padding-top:18px;font-size:13px;line-height:1.5;color:#64748b;">ينتهي هذا الرابط خلال ${expiresMinutes} دقيقة.</td></tr>
        <tr><td style="padding-top:10px;font-size:13px;line-height:1.5;color:#64748b;">إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
