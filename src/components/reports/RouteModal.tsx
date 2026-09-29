"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { Modal } from "@/components/ui/Modal";

/** Modal for intercepted routes – closing navigates back (restores map + filters). */
export function RouteModal({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Modal open onClose={() => router.back()} title={title} variant="brand" size="xl" closeLabel={t("common.close")}>
      {children}
    </Modal>
  );
}
