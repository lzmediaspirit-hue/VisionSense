import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, ScreenHeader } from "../components/ui";
import { Field, TextArea, TextInput, Toggle } from "../components/form";
import { strings } from "../copy/strings";
import { desiredRealityById } from "../lib/selectors";
import { useStore } from "../state/store";

/** Create or edit a Desired Reality. Edit mode when a matching :id is present. */
export function DesiredRealityFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useStore((s) => desiredRealityById(s, id));
  const addDesiredReality = useStore((s) => s.addDesiredReality);
  const updateDesiredReality = useStore((s) => s.updateDesiredReality);

  const isEdit = Boolean(existing);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [targetFeeling, setTargetFeeling] = useState(existing?.targetFeeling ?? "");
  const [normalizeIt, setNormalizeIt] = useState(existing?.normalizeIt ?? false);
  const [sourceActionNote, setSourceActionNote] = useState(
    existing?.sourceActionNote ?? ""
  );
  const [collectiveBelief, setCollectiveBelief] = useState(
    existing?.collectiveBeliefToRelease ?? ""
  );
  const [errors, setErrors] = useState<{ title?: string; feeling?: string }>({});

  const c = strings.desiredRealityForm;

  function handleSave() {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = c.titleRequired;
    if (!targetFeeling.trim()) nextErrors.feeling = c.feelingRequired;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      title: title.trim(),
      targetFeeling: targetFeeling.trim(),
      normalizeIt,
      sourceActionNote: sourceActionNote.trim() || undefined,
      collectiveBeliefToRelease: collectiveBelief.trim() || undefined,
    };

    if (existing) {
      updateDesiredReality(existing.id, payload);
      navigate(`/goals/${existing.id}`);
    } else {
      const created = addDesiredReality(payload);
      navigate(`/goals/${created.id}`);
    }
  }

  return (
    <div>
      <ScreenHeader title={isEdit ? c.editTitle : c.createTitle} />

      <Field label={c.titleLabel} htmlFor="dr-title" error={errors.title}>
        <TextInput
          id="dr-title"
          value={title}
          placeholder={c.titlePlaceholder}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field
        label={c.targetFeelingLabel}
        hint={c.targetFeelingHint}
        htmlFor="dr-feeling"
        error={errors.feeling}
      >
        <TextInput
          id="dr-feeling"
          value={targetFeeling}
          placeholder={c.targetFeelingPlaceholder}
          onChange={(e) => setTargetFeeling(e.target.value)}
        />
      </Field>

      <Toggle
        id="dr-normalize"
        label={c.normalizeLabel}
        hint={c.normalizeHint}
        checked={normalizeIt}
        onChange={setNormalizeIt}
      />

      <Field label={c.sourceActionLabel} htmlFor="dr-source">
        <TextArea
          id="dr-source"
          value={sourceActionNote}
          placeholder={c.sourceActionPlaceholder}
          onChange={(e) => setSourceActionNote(e.target.value)}
        />
      </Field>

      <Field label={c.collectiveBeliefLabel} htmlFor="dr-collective">
        <TextArea
          id="dr-collective"
          value={collectiveBelief}
          placeholder={c.collectiveBeliefPlaceholder}
          onChange={(e) => setCollectiveBelief(e.target.value)}
        />
      </Field>

      <div className="mt-6 flex gap-3">
        <Button onClick={handleSave}>{c.saveButton}</Button>
        <Button
          variant="secondary"
          onClick={() => navigate(existing ? `/goals/${existing.id}` : "/goals")}
        >
          {c.cancelButton}
        </Button>
      </div>
    </div>
  );
}
