"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export default function LocaleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value;
    // The pathname is like `/en/about`, so we need to remove the current locale
    const newPathname = pathname.startsWith(`/${locale}`)
      ? pathname.substring(locale.length + 1)
      : pathname;
    router.push(`/${newLocale}${newPathname}`);
  };

  return (
    <select
      value={locale}
      onChange={handleChange}
      className="p-2 border rounded-md"
    >
      <option value="en">English</option>
      <option value="pt-BR">Português (Brasil)</option>
    </select>
  );
}
