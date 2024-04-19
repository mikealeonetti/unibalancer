import { wethContract } from "./contracts/WethContract";
import { userWallet } from "./network";

import Debug from 'debug';
import { first } from "lodash";
import usdcContract from "./contracts/usdcContract";
import { initializeDatabase } from "./database";
import Engine from "./engine";
import BalanceHelpers from "./helpers/BalanceHelpers";
import PositionManager from "./helpers/PositionManager";

const debug = Debug("unibalancer:index");

(async function (): Promise<void> {
    try {
        await initializeDatabase();

        // Get the balance of eths
        const ethBalance = await BalanceHelpers.ethBalance();
        const usdcBalance = await usdcContract.balanceOf(userWallet.address);
        const wethBalance = await wethContract.balanceOf(userWallet.address);
        const positions = await PositionManager.getAllPositions();

        debug("ethBalance=%s", ethBalance);
        debug("usdcBalance=%s", usdcBalance);
        debug("wethBalacne=%s", wethBalance);
        debug("getAllPositions=%s", first(positions));

        // Init the DB
        await initializeDatabase();

        // Run the engine
        await new Engine().run();
    }
    catch (e) {
        console.error("Terminal error", e);
        process.exit(0);
    }
})();