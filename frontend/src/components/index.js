// Component exports for easier imports
export { default as AudioReporter } from "./AudioReporter.jsx";
export { default as PhotoReporter } from "./PhotoReporter.jsx";
export { default as Map } from "./Map.jsx";
export { default as VolunteerTaskList } from "./VolunteerTaskList.jsx";
export { default as ReportsList } from "./ReportsList.jsx";
export { default as MissionPanel } from "./MissionPanel.jsx";
export { default as Modal } from "./Modal.jsx";

// New feature components
export {
  TriageAlertBanner,
  getTriageCategoryFromUrgency,
} from "./TriageBadge.jsx";
export { default as ResourceTracker } from "./ResourceTracker.jsx";
export { default as AnalyticsDashboard } from "./AnalyticsDashboard.jsx";

// High Priority Safety Features
export { FloatingSOSButton } from "./SOSButton.jsx";
export { default as ResourceInventory } from "./ResourceInventory.jsx";

// Medium Priority Features
export { default as RoadConditions } from "./RoadConditions.jsx";
export { default as MissingPersons } from "./MissingPersons.jsx";
export { default as ShelterManagement } from "./ShelterManagement.jsx";

// Emergency Station Management
export { default as EmergencyStations } from "./EmergencyStations.jsx";

// Accessibility components
export {
  default as AccessibilitySettings,
  AccessibilityProvider,
} from "./AccessibilitySettings.jsx";

// Authentication components
export { default as PinLogin } from "./PinLogin.jsx";
export { default as VolunteerManagement } from "./VolunteerManagement.jsx";
export { default as RoleSelector } from "./RoleSelector.jsx";

// Navbar
export { default as Navbar } from "./Navbar.jsx";

// Offline / Sync
export { default as SyncStatusBar } from "./SyncStatusBar.jsx";
