import { Card, ScreenHeader } from "../components/ui";
import { strings } from "../copy/strings";
import { CURRENT_SCHEMA_VERSION } from "../lib/storage";
import { useStore } from "../state/store";

/**
 * Settings. Export/import and clear-data are wired in a later milestone (M5);
 * for now this shows the schema version and the current preference values.
 */
export function SettingsScreen() {
  const settings = useStore((s) => s.settings);

  return (
    <div>
      <ScreenHeader title={strings.settings.title} />

      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-ink">
          {strings.settings.dataSectionTitle}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {strings.settings.dataSectionBody}
        </p>
        <dl className="mt-3 text-sm">
          <div className="flex items-center justify-between py-1">
            <dt className="text-ink-soft">{strings.settings.schemaVersionLabel}</dt>
            <dd className="font-medium text-ink">v{CURRENT_SCHEMA_VERSION}</dd>
          </div>
          <div className="flex items-center justify-between py-1">
            <dt className="text-ink-soft">{strings.settings.languageLabel}</dt>
            <dd className="font-medium text-ink">
              {settings.languageMode === "bookVocabulary"
                ? strings.settings.languageBookVocabulary
                : strings.settings.languageSecular}
            </dd>
          </div>
          <div className="flex items-center justify-between py-1">
            <dt className="text-ink-soft">{strings.settings.relaxGateLabel}</dt>
            <dd className="font-medium text-ink">
              {settings.relaxGateEnabled ? strings.common.yes : strings.common.no}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
