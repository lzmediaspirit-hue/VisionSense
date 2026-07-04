import { useRef, useState } from "react";
import { Button, Card, ScreenHeader } from "../components/ui";
import { Field, TextInput, Toggle } from "../components/form";
import { strings } from "../copy/strings";
import { CURRENT_SCHEMA_VERSION } from "../lib/storage";
import { storageUsage } from "../lib/selectors";
import { todayKey } from "../lib/dates";
import { useStore } from "../state/store";

/**
 * Settings (feature #14): schema version, storage-usage monitor, JSON
 * export/import (sharing the same migration chain as a normal load, see
 * lib/storage.ts's `parseImportedEnvelope`), the relax-gate toggle, and a
 * two-step typed-confirmation "clear all data" action.
 */
export function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const usage = useStore(storageUsage);
  const updateSettings = useStore((s) => s.updateSettings);
  const exportStateJSON = useStore((s) => s.exportStateJSON);
  const importState = useStore((s) => s.importState);
  const reset = useStore((s) => s.reset);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportJSON, setPendingImportJSON] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [clearStep, setClearStep] = useState(false);
  const [clearPhrase, setClearPhrase] = useState("");

  const c = strings.settings;
  const usagePercent = Math.round(usage.ratio * 100);
  const clearPhraseMatches =
    clearPhrase.trim().toLowerCase() === c.clearConfirmPhrase.toLowerCase();

  function handleExport() {
    const json = exportStateJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visionsense-export-${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingImportJSON(String(reader.result ?? ""));
      setImportMessage(null);
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    if (!pendingImportJSON) return;
    try {
      importState(pendingImportJSON);
      setImportMessage(c.importSuccess);
      setPendingImportJSON(null);
    } catch {
      setImportMessage(c.importUnreadable);
    }
  }

  function cancelImport() {
    setPendingImportJSON(null);
    setImportMessage(null);
  }

  function confirmClear() {
    if (!clearPhraseMatches) return;
    reset();
    setClearStep(false);
    setClearPhrase("");
  }

  return (
    <div>
      <ScreenHeader title={c.title} />

      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-ink">{c.dataSectionTitle}</h2>
        <p className="mt-1 text-sm text-ink-soft">{c.dataSectionBody}</p>
        <dl className="mt-3 text-sm">
          <div className="flex items-center justify-between py-1">
            <dt className="text-ink-soft">{c.schemaVersionLabel}</dt>
            <dd className="font-medium text-ink">v{CURRENT_SCHEMA_VERSION}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-ink-soft">
            <span>{c.storageUsageLabel}</span>
            <span>{usagePercent}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-sunken">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200 ease-calm"
              style={{ width: `${Math.min(100, usagePercent)}%` }}
            />
          </div>
          {usage.ratio > 0.8 ? (
            <p className="mt-2 text-xs text-ink-soft">{c.storageUsageWarning}</p>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={handleExport}>
            {c.exportButton}
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {c.importButton}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleFileChosen}
            aria-label={c.importButton}
          />
        </div>

        {pendingImportJSON ? (
          <div className="mt-4 rounded-xl border border-line bg-paper-sunken p-3">
            <p className="text-sm text-ink">{c.importConfirmTitle}</p>
            <p className="mt-1 text-xs text-ink-soft">{c.importConfirmBody}</p>
            <div className="mt-3 flex gap-3">
              <Button onClick={confirmImport}>{c.importConfirmButton}</Button>
              <Button variant="ghost" onClick={cancelImport}>
                {strings.common.cancel}
              </Button>
            </div>
          </div>
        ) : null}

        {importMessage ? <p className="mt-3 text-sm text-ink-soft">{importMessage}</p> : null}
      </Card>

      <Card className="mb-4">
        <h2 className="text-sm font-semibold text-ink">{c.preferencesSectionTitle}</h2>
        <div className="mt-3">
          <Toggle
            id="relax-gate-toggle"
            checked={settings.relaxGateEnabled}
            onChange={(next) => updateSettings({ relaxGateEnabled: next })}
            label={c.relaxGateLabel}
            hint={c.relaxGateHint}
          />
        </div>
        <dl className="mt-1 text-sm">
          <div className="flex items-center justify-between py-1">
            <dt className="text-ink-soft">{c.languageLabel}</dt>
            <dd className="font-medium text-ink">
              {settings.languageMode === "bookVocabulary"
                ? c.languageBookVocabulary
                : c.languageSecular}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-ink">{c.clearSectionTitle}</h2>
        <p className="mt-1 text-sm text-ink-soft">{c.clearSectionBody}</p>
        {!clearStep ? (
          <div className="mt-3">
            <Button variant="ghost" onClick={() => setClearStep(true)}>
              {c.clearButton}
            </Button>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-line bg-paper-sunken p-3">
            <p className="text-sm text-ink">{c.clearConfirmBody}</p>
            <Field label={c.clearConfirmLabel} htmlFor="clear-confirm-input">
              <TextInput
                id="clear-confirm-input"
                value={clearPhrase}
                onChange={(e) => setClearPhrase(e.target.value)}
                placeholder={c.clearConfirmPhrase}
              />
            </Field>
            <div className="flex gap-3">
              <Button variant="ghost" disabled={!clearPhraseMatches} onClick={confirmClear}>
                {c.clearConfirmButton}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setClearStep(false);
                  setClearPhrase("");
                }}
              >
                {strings.common.cancel}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
