
import Debug from 'debug';
import Decimal from "decimal.js";
import collectFees from "./collectFees";
import { DBPosition } from "./database/models/DBPosition";
import { DBPositionHistory } from "./database/models/DBPositionHistory";
import { PositionInfo } from "./helpers/PositionManager";
import logger from "./logger";

const debug = Debug("unibalancer:shouldTriggerRedeposit");

export default async function (positionInfos: PositionInfo[]) {
    // Loop each whirlperl
    for (const positionInfo of positionInfos) {

        const {
            positionId,
            tokensOwed0,
            tokensOwed1
        } = positionInfo;
        const positionIdString = positionId.toString();

        debug("Checking %s to see if we need to re-deposit.", positionIdString);

        // Can we get the history?
        const [
            dbPositionHistory,
            dbPosition
        ] = await Promise.all([
            DBPositionHistory.getLatestByPositionIdString(positionIdString),
            DBPosition.getByPositionIdString(positionIdString)
        ]);

        // Do we have?
        if (!dbPositionHistory) {
            logger.warn("Cannot find position history [%s] to check for re-deposit.", positionIdString);
            continue;
        }
        if (!dbPosition) {
            logger.warn("Cannot find position [%s] to check for re-deposit.", positionIdString);
            continue;
        }

        debug("position.fees.tokenA=%s, position.fees.tokenB=%s", tokensOwed0, tokensOwed1);

        const priceAsDecimal = positionInfo.price.toDecimal();

        // See if we have at least 1% in gains
        const totalFeesInUSDC = tokensOwed0.times(priceAsDecimal).plus(tokensOwed1);
        const enteredPriceUSDC = new Decimal(dbPositionHistory.enteredPriceUSDC);

        debug("totalFeesInUSDC=%s, enteredPriceUSDC=%s", totalFeesInUSDC, enteredPriceUSDC);

        // Now
        const now = new Date();

        // Get what percent of the opening price we have in feez now
        const percentOfOpeningPrice = totalFeesInUSDC.div(enteredPriceUSDC).times(100);
        const lastRewardsCollected = dbPosition.lastRewardsCollected || dbPosition.createdAt || now;

        const millisSinceRewardsCollected = now.valueOf() - lastRewardsCollected.valueOf();
        const hoursSinceLastRewardsCollected = millisSinceRewardsCollected / (60 * 60 * 1000);

        debug("percentOfOpeningPrice=%s", percentOfOpeningPrice);

        debug("lastRewardsCollected=%s, millisSinceRewardsCollected=%s, hoursSinceLastRewardsCollected=%s", lastRewardsCollected, millisSinceRewardsCollected, hoursSinceLastRewardsCollected);

        // Should we
        let shouldTriggerRedeposit = false;

        // Do we have a trigger?
        if (percentOfOpeningPrice.gte(1)) {
            logger.info("Percent of opening price is greater than 1%. Trigger re-deposit.");
            shouldTriggerRedeposit = true;
        }
        else if (hoursSinceLastRewardsCollected >= 24) {
            logger.info("Over 24 hours since last re-deposit. Trigger re-deposit.");
            shouldTriggerRedeposit = true;
        }

        // Is it greater than 1%?
        if (shouldTriggerRedeposit) {
            // First trigger collection
            logger.debug("Collecting rewards.");

            await collectFees(positionInfo);

            // Now redeposit
            logger.debug("Re-depositing.");

            dbPosition.redepositAttemptsRemaining = 10;
            await dbPosition.save();
        }
        else {
            debug("No re-deposit conditions met.");
        }
    }
}