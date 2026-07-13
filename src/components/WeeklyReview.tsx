// Weekly review (v1.4, SPEC 11.3): four optional short prompts saved per ISO
// week, with past reviews listed read-only (newest first) below the form. No
// blocking dialogs, no guilt copy — this is a nudge, not an obligation.

import { useCallback, useMemo } from 'react';
import { isoWeekKey, isoWeekLabel, weekEvidence } from '../model/journal';
import type { Review } from '../model/types';
import { useStore } from '../state/store';

/** Habit chips beyond this count collapse into a single "+N more" chip. */
const MAX_HABIT_CHIPS = 8;

interface WeeklyReviewProps {
  onClose: () => void;
}

type ReviewText = Pick<Review, 'wins' | 'obstacle' | 'change' | 'focus'>;

function nowIso(): string {
  return new Date().toISOString();
}

function emptyReview(): Review {
  return { wins: '', obstacle: '', change: '', focus: '', updatedAt: '' };
}

export function WeeklyReview({ onClose }: WeeklyReviewProps) {
  const { state, setReview } = useStore();
  const weekKey = useMemo(() => isoWeekKey(new Date()), []);
  const current = state.reviews[weekKey] ?? emptyReview();

  // What actually happened this week, so "What went well?" has something to
  // reflect against (v1.9, SPEC 16). Purely informational — no new state.
  const evidence = useMemo(() => weekEvidence(state.charts, new Date()), [state.charts]);
  const shownHabits = evidence.habits.slice(0, MAX_HABIT_CHIPS);
  const extraHabits = evidence.habits.length - shownHabits.length;
  const hasEvidence = evidence.habits.length > 0 || evidence.tasksDone > 0;

  const save = useCallback(
    (patch: Partial<ReviewText>) => {
      const base = state.reviews[weekKey] ?? emptyReview();
      setReview(weekKey, { ...base, ...patch, updatedAt: nowIso() });
    },
    [state.reviews, weekKey, setReview],
  );

  // Past reviews, newest week first, excluding this week's own (still-editable)
  // entry above. ISO week keys (YYYY-Www, zero-padded) sort lexicographically
  // in chronological order, so a plain string sort works.
  const pastReviews = useMemo(() => {
    return Object.entries(state.reviews)
      .filter(([key]) => key !== weekKey)
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
  }, [state.reviews, weekKey]);

  return (
    <div className="review" data-theme="minimal" aria-label="Weekly review">
      <header className="review__header">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onClose}
          aria-label="Back to your charts"
        >
          <span aria-hidden="true">‹</span> Charts
        </button>
        <span className="review__brand">VisionSense</span>
        <span className="review__spacer" />
      </header>

      <div className="review__hero">
        <p className="review__eyebrow">Weekly review</p>
        <h1 className="review__week">{isoWeekLabel(weekKey)}</h1>
      </div>

      <section className="review__section" aria-labelledby="review-form-h">
        <h2 className="visually-hidden" id="review-form-h">
          This week&apos;s review
        </h2>
        <p className="review__intro">
          A written weekly review is the highest-leverage habit in this method. All four prompts
          are optional — a few honest words are enough.
        </p>

        {hasEvidence && (
          <div className="review__evidence" aria-label="This week's evidence">
            <span className="review__evidence-intro">This week:</span>
            {shownHabits.map((h, i) => (
              <span className="review__chip" key={i}>
                {h.days} / {h.target} <span className="review__chip-name">{h.name}</span>
              </span>
            ))}
            {extraHabits > 0 && <span className="review__chip">+{extraHabits} more</span>}
            {evidence.tasksDone > 0 && (
              <span className="review__chip">
                {evidence.tasksDone} action{evidence.tasksDone === 1 ? '' : 's'} done
              </span>
            )}
            {evidence.streak > 0 && (
              <span className="review__chip">{evidence.streak}-day streak</span>
            )}
          </div>
        )}

        <label className="field">
          <span className="field__label">What went well?</span>
          <textarea
            className="field__input field__textarea"
            rows={2}
            value={current.wins}
            onChange={(e) => save({ wins: e.target.value })}
            placeholder="Short and honest."
          />
        </label>

        <label className="field">
          <span className="field__label">What got in the way?</span>
          <textarea
            className="field__input field__textarea"
            rows={2}
            value={current.obstacle}
            onChange={(e) => save({ obstacle: e.target.value })}
            placeholder="No guilt — just noticing."
          />
        </label>

        <label className="field">
          <span className="field__label">What will you do differently?</span>
          <textarea
            className="field__input field__textarea"
            rows={2}
            value={current.change}
            onChange={(e) => save({ change: e.target.value })}
            placeholder="One small adjustment."
          />
        </label>

        <label className="field">
          <span className="field__label">#1 focus next week</span>
          <input
            type="text"
            className="field__input"
            value={current.focus}
            onChange={(e) => save({ focus: e.target.value })}
            placeholder="One thing that matters most."
          />
        </label>
      </section>

      <section className="review__section" aria-labelledby="review-past-h">
        <h2 className="review__section-title" id="review-past-h">
          Past reviews
        </h2>
        {pastReviews.length === 0 ? (
          <p className="review__empty">
            No past reviews yet — once you save next week&apos;s, it will show up here.
          </p>
        ) : (
          <ul className="review-list">
            {pastReviews.map(([key, review]) => (
              <li key={key} className="review-card">
                <p className="review-card__week">{isoWeekLabel(key)}</p>
                {review.wins.trim() !== '' && (
                  <p className="review-card__row">
                    <strong>Went well:</strong> {review.wins}
                  </p>
                )}
                {review.obstacle.trim() !== '' && (
                  <p className="review-card__row">
                    <strong>Got in the way:</strong> {review.obstacle}
                  </p>
                )}
                {review.change.trim() !== '' && (
                  <p className="review-card__row">
                    <strong>Do differently:</strong> {review.change}
                  </p>
                )}
                {review.focus.trim() !== '' && (
                  <p className="review-card__row">
                    <strong>Focus:</strong> {review.focus}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
