import Decimal from "decimal.js";
import { USDC_TOKEN, WETH_TOKEN } from "../constants";
import PositionManager from "../helpers/PositionManager";
import { initializeDatabase } from "../database";

(async function() {
    await initializeDatabase();

    await PositionManager.approveAllowances(
        new Decimal("10000").toCurrencyAmount(WETH_TOKEN),
        new Decimal("10000").toCurrencyAmount(USDC_TOKEN),
    );

    console.log( "Did all allowances." );

    process.exit( 0 );
})();