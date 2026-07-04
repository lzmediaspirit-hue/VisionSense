import { ScreenHeader } from "../components/ui";
import { strings } from "../copy/strings";

// M0 placeholder. Desired Realities CRUD lands in M1.
export function GoalsScreen() {
  return (
    <div>
      <ScreenHeader title={strings.goals.title} subtitle={strings.goals.subtitle} />
    </div>
  );
}
