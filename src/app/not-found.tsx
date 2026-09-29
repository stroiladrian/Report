import Link from "next/link";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const { t } = await getT();
  return (
    <main id="main" className="grid min-h-[70vh] place-items-center px-4 text-center">
      <div>
        <p className="text-6xl font-extrabold text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold">{t("common.notFoundTitle")}</h1>
        <p className="mt-2 text-slate-600">{t("common.notFoundText")}</p>
        <Link href="/" className="link mt-4 inline-block">
          {t("common.home")}
        </Link>
      </div>
    </main>
  );
}
