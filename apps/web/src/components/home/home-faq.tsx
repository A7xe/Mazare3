'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type HomeFaqItem = {
  id: string;
  question: string;
  answer: string;
};

type HomeFaqProps = {
  title: string;
  subtitle: string;
  items: HomeFaqItem[];
  contentDir?: 'rtl' | 'ltr';
};

export function HomeFaq({ title, subtitle, items, contentDir = 'rtl' }: HomeFaqProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!items.length) return null;

  return (
    <section dir={contentDir} className="bg-transparent" data-testid="home-faq">
      <div className="grid gap-6 lg:grid-cols-[minmax(220px,0.34fr)_minmax(0,0.66fr)] lg:items-start lg:gap-10">
        <div className="text-start lg:pt-1">
          <h2 className="text-[20px] font-bold leading-tight text-[#0D2046] sm:text-[22px]">
            {title}
          </h2>
          <p className="mt-1.5 max-w-[280px] text-[13px] font-medium leading-relaxed text-[#7B8494]">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {items.map((item) => {
            const open = openId === item.id;
            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-full border border-[#E8EEF6] bg-white shadow-[0_2px_10px_rgba(35,72,120,.03)] transition-[border-radius] data-[open=true]:rounded-[18px]"
                data-open={open}
                data-testid={`home-faq-item-${item.id}`}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : item.id)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-start sm:px-5"
                >
                  <span className="min-w-0 flex-1 text-[13.5px] font-semibold leading-snug text-[#0D2046] sm:text-[14px]">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-[#6B7C94] transition-transform duration-200 ${
                      open ? 'rotate-180' : ''
                    }`}
                    aria-hidden
                  />
                </button>

                {open ? (
                  <div className="border-t border-[#EEF3F9] px-4 pb-4 pt-2 sm:px-5">
                    <p className="text-[12.5px] font-medium leading-7 text-[#53637A] sm:text-[13px]">
                      {item.answer}
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
