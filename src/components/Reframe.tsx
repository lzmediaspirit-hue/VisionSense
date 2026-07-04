import { useNavigate } from "react-router-dom";
import { Button } from "./ui";
import { strings } from "../copy/strings";

/**
 * Setback reframe. Appears contextually after a gentle miss — never as its own
 * nav destination. Shows the three C2 prompts verbatim (book-analysis.md C2 /
 * p.22-23) and a single calm CTA into the Evidence (past wins) tab.
 */
export function Reframe({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const c = strings.reframe;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
      className="fixed inset-0 z-30 flex items-center justify-center bg-paper/95 p-5 backdrop-blur animate-gentle-fade"
    >
      <div className="w-full max-w-[560px]">
        <h2 className="text-xl font-semibold text-ink">{c.title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{c.intro}</p>

        <ul className="mt-5 space-y-3">
          {[c.promptLookAt, c.promptFeelAbout, c.promptThinkAbout].map((prompt) => (
            <li
              key={prompt}
              className="rounded-2xl border border-line bg-paper-raised p-4 text-[15px] leading-relaxed text-ink"
            >
              {prompt}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => navigate("/evidence")}>{c.winsCta}</Button>
          <Button variant="secondary" onClick={onClose}>
            {c.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}
