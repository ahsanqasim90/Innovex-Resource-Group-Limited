import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import WorkspaceScreen from "./src/WorkspaceScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <WorkspaceScreen />
    </SafeAreaProvider>
  );
}
