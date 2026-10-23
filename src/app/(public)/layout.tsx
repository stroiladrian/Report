import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { ThemeScope } from "@/components/layout/ThemeScope";
import { parseTheme, THEME_COOKIE } from "@/lib/theme/shared";

export default async function PublicLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <ThemeScope area="public" initial={theme} />
      <Header />
      <main id="main">{children}</main>
      {modal}
    </>
  );
}
