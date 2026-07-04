import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { TodayScreen } from "./screens/TodayScreen";
import { GoalsScreen } from "./screens/GoalsScreen";
import { GoalDetailScreen } from "./screens/GoalDetailScreen";
import { EvidenceScreen } from "./screens/EvidenceScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayScreen />} />
        <Route path="/goals" element={<GoalsScreen />} />
        <Route path="/goals/:id" element={<GoalDetailScreen />} />
        <Route path="/evidence" element={<EvidenceScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Route>
    </Routes>
  );
}
