import Bluebird from "bluebird";
import { isEmpty } from "lodash";
import closeOutOfRangePositions from "./closeOutOfRangePositions";
import logger from "./logger";
import resyncDatabasePositions from "./resyncDatabasePositions";

import Debug from 'debug';
import checkForPositionsNeedingRedeposit from "./checkForPositionsNeedingRedeposit";
import PositionManager from "./helpers/PositionManager";
import sendHeartbeatAlerts from "./sendHeartbeatAlerts";
import shouldTriggerRedeposit from "./shouldTriggerRedeposit";
import shouldSaveStats from "./shouldSaveStats";
import PoolHelper from "./helpers/PoolHelper";
import { FeeAmount } from "@uniswap/v3-sdk";

const debug = Debug("unibalancer:engine");

export default async function (): Promise<void> {
    // The main async event loop
    while (true) {
        try {
            debug("minute executed");
            // Get all open positions
            let openPositions = await PositionManager.getAllPositions();

            debug("openPositions=", openPositions);

            // Cross check the database
            await resyncDatabasePositions(openPositions);

            // Close any positions out of range
            openPositions = await closeOutOfRangePositions(openPositions);

            //debug( "New open positions=", openPositions );

            // Save balances
            await shouldSaveStats(openPositions);

            // Send heartbeats
            // This should probably go after
            await sendHeartbeatAlerts(openPositions);

            // Do we have to trigger a re-deposit?
            await shouldTriggerRedeposit(openPositions);

            // Do we have no more positions open?
            if (isEmpty(openPositions)) {
                logger.info("No positions open. Attempting to open another one.");

                await PositionManager.mintOrIncreasePosition();
            }

            // Do we have any positions that need to be redeposited
            await checkForPositionsNeedingRedeposit(openPositions);
        }
        catch (e) {
            logger.error("Error running minute.", e);
        }

        // 1 minute
        await Bluebird.delay(60 * 1000);
    }
}