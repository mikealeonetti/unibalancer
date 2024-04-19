import Bluebird from "bluebird";
import { addMinutes } from "date-fns";
import closePosition from "./closePosition";
import { TOLERANCE_IN_MINUTES } from "./constants";
import logger from "./logger";

import Debug from 'debug';
import { DBPosition } from "./database/models/DBPosition";
import { PositionInfo } from "./helpers/PositionManager";

const debug = Debug("unibalancer:closeOutOfRangePositions");

async function handlePosition(position: PositionInfo): Promise<boolean> {
    // Shorthand the mint
    const { positionId } = position;

    // Get in the database
    const dbPosition = await DBPosition.getByPositionId(positionId);

    // Do we not have?
    if (!dbPosition) {
        logger.error("Position [%s] not found to handle.", positionId);
        return (false);
    }

    const { tickCurrent } = position.poolAndPoolInfo.pool;
    const { tickUpper, tickLower } = position;

    // Check if the price is out of range
    const isOutOfRange = tickCurrent <= tickLower || tickCurrent >= tickUpper;
    //const isOutOfRange = true;

    debug("pool [%s] price=%s, tickCurrentIndex=%s, tickLowerIndex=%s, tickUpperIndex=%s, isOutOfRange=%s",
        positionId, position.price.toFixed(), tickCurrent, tickLower, tickUpper, isOutOfRange);

    // Are we keeping the position
    let keepPosition = true;

    // Are we out of range?
    if (isOutOfRange) {
        // Should we close now?
        let closePositionNow: boolean = false;

        // Check for tolerance
        if (TOLERANCE_IN_MINUTES == 0) {
            logger.info("[%s] went out of range ant no tolerance set. Closing now.", positionId);

            // Simple close it now
            closePositionNow = true;
        }
        // Have we been out of range?
        else if (dbPosition.outOfRangeSince != null) {
            // Is it time?
            const toleranceExpires = addMinutes(dbPosition.outOfRangeSince, TOLERANCE_IN_MINUTES);

            // Did we pass the expiration?
            if (new Date() >= toleranceExpires) {
                logger.info("[%s] went out of range for at least %d minutes. Will close to rebalance.", positionId, TOLERANCE_IN_MINUTES);

                // Close position
                closePositionNow = true;
            }
        }
        else {
            logger.info("[%s] went out of range. Going to rebalance in %d minutes if it doesn't come back in range.", positionId, TOLERANCE_IN_MINUTES);

            // Set the out of range since now
            dbPosition.outOfRangeSince = new Date();
            // Save
            await dbPosition.save();
        }

        // Have we been out of range?
        if (closePositionNow) {
            // Close position
            const positionRemoved = await closePosition(position, dbPosition);

            // Do not keep the position
            keepPosition = !positionRemoved;
        }
    }
    // Do we have to clear the outOfRangeSince
    else if (dbPosition.outOfRangeSince != null) {
        logger.info("[%s] came back in range. Going to wait to close it.", positionId);
        // Clear it because we in range
        dbPosition.outOfRangeSince = null;
        await dbPosition.save();
    }

    return keepPosition;
}

export default async function (positions: PositionInfo[]): Promise<PositionInfo[]> {
    return Bluebird.filter(positions, handlePosition, { concurrency: 1 });
}