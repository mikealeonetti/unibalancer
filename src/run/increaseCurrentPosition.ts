import { first } from "lodash";
import { initializeDatabase } from "../database";
import PositionManager from "../helpers/PositionManager";

(async function () {
    await initializeDatabase();

    // Get all current
    const openPositions = await PositionManager.getAllPositions();

    // Get the ferst
    const firstOpenPositionInfo = first(openPositions);

    if (firstOpenPositionInfo) {
        // Now attempt to re-deposit
        await PositionManager.mintOrIncreasePosition(firstOpenPositionInfo);
    }
})();