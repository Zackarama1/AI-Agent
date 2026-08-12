import { AdvancedPortfolioScreen } from "./AdvancedPortfolioScreen";
import { PortfolioScreen } from "./PortfolioScreen";
import { useApp } from "../state/AppState";

// The Portfolio tab renders either layout depending on the chosen mode.
export function PortfolioTab(props: any) {
  const { mode } = useApp();
  return mode === "advanced" ? (
    <AdvancedPortfolioScreen {...props} />
  ) : (
    <PortfolioScreen {...props} />
  );
}
