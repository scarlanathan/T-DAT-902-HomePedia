"use client";

import { InfoPopoverButton } from "@/components/ui/InfoPopoverButton";
import { useLocale } from "@/lib/locale-context";

export type DatasetSourceInfo = {
  name: string;
  about: string;
  detail?: string;
};

type Props = {
  title: string;
  source: DatasetSourceInfo;
};

export function DatasetInfoButton({ title, source }: Props) {
  const { t } = useLocale();
  const contentKey = `${source.name}|${source.about}|${source.detail ?? ""}`;

  return (
    <InfoPopoverButton
      size="sm"
      variant="question"
      ariaLabel={t("datasetInfo.buttonLabel", { title })}
      dialogLabel={t("datasetInfo.dialogLabel", { title })}
      contentKey={contentKey}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-400">
        {t("datasetInfo.source")}
      </p>
      <p className="mt-1 font-medium text-ink-900 dark:text-ink-50">
        {source.name}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
        {source.about}
      </p>
      {source.detail ? (
        <p className="mt-2 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
          {source.detail}
        </p>
      ) : null}
    </InfoPopoverButton>
  );
}
