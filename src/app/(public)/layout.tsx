import { Header } from "@/components/layout/Header";

export default function PublicLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      {modal}
    </>
  );
}
