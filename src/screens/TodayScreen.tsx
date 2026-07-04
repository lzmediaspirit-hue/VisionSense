import { ScreenHeader } from "../components/ui";
import { strings } from "../copy/strings";

// M0 placeholder. The daily loop (stats, check-in, habits, reframe) lands in M2.
export function TodayScreen() {
  return (
    <div>
      <ScreenHeader title={strings.today.title} subtitle={strings.app.tagline} />
    </div>
  );
}
