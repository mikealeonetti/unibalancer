import { findIndex } from "lodash";
import { DBPosition } from "./database/models/DBPosition";
import { DBPositionHistory } from "./database/models/DBPositionHistory";
import { PositionInfo } from "./helpers/PositionManager";
import logger from "./logger";


export default async function (positions: PositionInfo[]): Promise<void> {
    // Get all positions from our database
    const dbPositions = await DBPosition.findAll();

    // Find all positions not in our database
    const notInDatabase = positions.filter(position => findIndex(dbPositions, { positionId: position.positionId.toString() }) == -1);

    // Find all database stuff not in positions
    const notInPositions = dbPositions.filter(dbPosition => positions.findIndex(position => position.positionId.toString() == dbPosition.positionId) == -1);

    // Add all new positions
    for (const position of notInDatabase) {
        // Shorthand
        const { positionId } = position;

        // Report
        logger.info("Not tracking position [%s]. Adding to the database to track.", positionId);

        const priceDecimal = position.price.toDecimal();

        // Add a new entry
        await DBPosition.create({
            positionId: positionId.toString(),
            previousPrice: position.price.toString(),
            previousOwedFeesTokenA: position.tokensOwed0.toString(),
            previousOwedFeesTokenB: position.tokensOwed1.toString(),
            previousOwedFeesTotalUSDC: position.tokensOwed0.times(priceDecimal).plus(position.tokensOwed1).toString()
        });

        // Add to the history
        await DBPositionHistory.create({
            positionId: positionId.toString(),
            enteredPriceUSDC: position.position.amount0.toDecimal().times(priceDecimal).plus(position.position.amount1.toDecimal()).toString(),
            liquidityAtOpen: position.position.liquidity.toString()
        });
    }

    // Close all previous positions
    for (const dbPosition of notInPositions) {
        // Report
        logger.info("Position was closed [%s].", dbPosition.positionId);

        // Upsert the history
        const history = await DBPositionHistory.getLatestByPositionIdString(dbPosition.positionId);

        // Set the closed date
        if (history) {
            history.closed = new Date(); // Now
            await history.save();
        }

        // Remove from DB
        await dbPosition.destroy();
    }
}