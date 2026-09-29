import { branding } from "@config/branding";
import { tr } from "@/lib/i18n/core";
import { getT } from "@/lib/i18n/server";
import { Footer } from "@/components/layout/Footer";

export const metadata = { title: "Privacy" };

/** Placeholder privacy notice – replace the text with your organisation's legal copy. */
export default async function PrivacyPage() {
  const { t, locale } = await getT();
  const org = tr(branding.organizationName, locale);
  const ro = locale === "ro";
  return (
    <>
      <article className="container-page max-w-3xl space-y-4 py-8 text-slate-800">
        <h1 className="text-3xl font-extrabold">{t("privacy.title")}</h1>
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
          {ro ? "Text demonstrativ – înlocuiți-l cu nota de informare a organizației dumneavoastră." : "Demo text – replace with your organisation's privacy notice."}
        </p>
        <h2 className="text-xl font-bold">{ro ? "Ce date colectăm" : "What we collect"}</h2>
        <p>
          {ro
            ? `${org} prelucrează numele, adresa de e-mail și, opțional, numărul de telefon pentru a gestiona contul și a vă informa despre sesizări. Conținutul sesizărilor (descriere, categorie, locație, fotografii) este public, fără date de identificare.`
            : `${org} processes your name, e-mail address and optional phone number to run your account and keep you informed about your reports. Report content (description, category, location, photos) is public without identifying data.`}
        </p>
        <h2 className="text-xl font-bold">{ro ? "Fotografii" : "Photos"}</h2>
        <p>
          {ro
            ? "Metadatele fotografiilor (inclusiv coordonatele GPS și modelul aparatului) sunt eliminate automat la încărcare."
            : "Photo metadata (including GPS coordinates and camera model) is removed automatically on upload."}
        </p>
        <h2 id="terms" className="text-xl font-bold">{ro ? "Termeni de utilizare" : "Terms of use"}</h2>
        <p>
          {ro
            ? "Nu publicați date personale ale altor persoane, conținut ofensator sau informații false. Sesizările care încalcă aceste reguli pot fi ascunse."
            : "Do not publish other people's personal data, offensive content or false information. Reports breaking these rules may be hidden."}
        </p>
        <p>
          {t("footer.contact")}: <a className="link" href={`mailto:${branding.contact.email}`}>{branding.contact.email}</a>
        </p>
      </article>
      <Footer />
    </>
  );
}
