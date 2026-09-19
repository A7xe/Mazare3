/** Canonical EN/AR glossary for launch-candidate legal drafting. */
export const LEGAL_GLOSSARY = {
  Booking: { en: 'Booking', ar: 'الحجز' },
  Owner: { en: 'Owner', ar: 'المالك' },
  Customer: { en: 'Customer', ar: 'الزبون' },
  Deposit: { en: 'Deposit', ar: 'العربون' },
  Balance: { en: 'Balance', ar: 'الرصيد المتبقي' },
  Refund: { en: 'Refund', ar: 'الاسترداد' },
  CancellationCharge: { en: 'Cancellation charge', ar: 'رسوم الإلغاء' },
  NoShow: { en: 'No-show', ar: 'عدم الحضور' },
  CheckIn: { en: 'Check-in', ar: 'تسجيل الوصول' },
  Reschedule: { en: 'Reschedule', ar: 'إعادة الجدولة' },
  ForceMajeure: { en: 'Force majeure', ar: 'القوة القاهرة' },
  VerifiedByMazare3: { en: 'Verified by Mazare3', ar: 'تم التحقق بواسطة Mazare3' },
  Settlement: { en: 'Settlement', ar: 'التسوية' },
  Commission: { en: 'Commission', ar: 'العمولة' },
  PersonalData: { en: 'Personal Data', ar: 'البيانات الشخصية' },
  Consent: { en: 'Consent', ar: 'الموافقة' },
} as const;

export type LegalGlossaryKey = keyof typeof LEGAL_GLOSSARY;
