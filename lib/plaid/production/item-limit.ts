import { ProductionPlaidConfigurationError } from "./config.ts";

export function assertFounderPilotItemLimit(hasExistingProductionItem: boolean) {
  if (hasExistingProductionItem) {
    throw new ProductionPlaidConfigurationError("PRODUCTION_ITEM_LIMIT_REACHED", "The founder pilot permits exactly one production financial institution.");
  }
}
