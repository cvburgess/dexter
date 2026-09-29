import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { EmptyScreen } from "@/components/EmptyScreen";
import { ListsView } from "@/components/ListsView";
import { useIsLargeDevice } from "@/hooks/useIsLargeDevice";
import { useTheme } from "@/utils/theme";

// The Lists tab (DEX-221) — large screens only, registered at every width like
// Week so a deep-linked /lists below the breakpoint still resolves.
export default function ListsScreen() {
  const largeDevice = useIsLargeDevice();
  const theme = useTheme();

  if (!largeDevice) {
    return (
      <SafeAreaView
        edges={["top", "left", "right"]}
        style={[styles.narrow, { backgroundColor: theme.colors.background }]}
      >
        <EmptyScreen message="The Lists view needs a wider screen. Use the Today tab here, or open Dexter on a larger one." />
      </SafeAreaView>
    );
  }

  return <ListsView />;
}

const styles = StyleSheet.create({
  narrow: {
    flex: 1,
  },
});
