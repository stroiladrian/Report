export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md space-y-4">{children}</div>
    </div>
  );
}
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow-sm sm:p-6">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      {children}
    </section>
  );
}
