'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  text: string;
  maxChars?: number;
};

export function PropertyAboutText({ text, maxChars = 220 }: Props) {
  const t = useTranslations('property');
  const [expanded, setExpanded] = useState(false);
  const needsClamp = text.length > maxChars;
  const shown = !needsClamp || expanded ? text : `${text.slice(0, maxChars).trimEnd()}…`;

  return (
    <div>
      <p className="ps-3 text-[13px] font-semibold leading-relaxed text-[#5B6B7C] sm:ps-4">{shown}</p>
      {needsClamp ? (
        <button
          type="button"
          className="mt-3 text-[12px] font-extrabold text-[#2F6EF6] hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? t('readLess') : t('readMore')}
        </button>
      ) : null}
    </div>
  );
}
