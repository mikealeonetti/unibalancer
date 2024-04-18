
import Debug from 'debug';
import Decimal from "decimal.js";
import collectFees from "./collectFees";
import { DBPosition } from "./database/models/DBPosition";
import { DBPositionHistory } from "./database/models/DBPositionHistory";
import { PositionInfo } from "./helpers/PositionManager";
import logger from "./logger";
import { REBALANCE_AT_PERCENT, REBALANCE_PER_HOUR_COUNT, REFUSE_COLLECTION_TOO_CLOSE_PERCENT } from './constants';

const debug = Debug("unibalancer:shouldTriggerRedeposit");

export default async function (positionInfos: PositionInfo[]) {
    // Loop each whirlperl
    for (const positionInfo of positionInfos) {

        const {
            positionId,
            tokensOwed0,
            tokensOwed1,
            price
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
        // Do not touch anything out of range
        if (dbPosition.outOfRangeSince != null) {
            logger.info("Position [%s] of of range. Refusing to collect rewards.", positionIdString);
            continue;
        }

        debug("position.fees.tokenA=%s, position.fees.tokenB=%s", tokensOwed0, tokensOwed1);

        const priceAsDecimal = price.toDecimal();

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
        let shouldCollectFees = false;

        debug("REBALANCE_AT_PERCENT=%s, REBALANCE_PER_HOUR_COUNT=%s", REBALANCE_AT_PERCENT, REBALANCE_PER_HOUR_COUNT);

        // Do we have a trigger?
        if (REBALANCE_AT_PERCENT > 0 && percentOfOpeningPrice.gte(REBALANCE_AT_PERCENT)) {
            logger.info("Percent of opening price is greater than 1%. Trigger re-deposit.");
            shouldCollectFees = true;
        }
        else if (REBALANCE_PER_HOUR_COUNT > 0 && hoursSinceLastRewardsCollected >= REBALANCE_PER_HOUR_COUNT) {
            logger.info("Over 24 hours since last re-deposit. Trigger re-deposit.");
            shouldCollectFees = true;
        }

        // Is it greater than 1%?
        if (shouldCollectFees) {
            // Get the proximity to the top and bottom
            const distancesToRanges = [
                price.subtract(positionInfo.lowerPrice).divide(price).multiply(100),
                positionInfo.upperPrice.subtract(price).divide(price).multiply(100)
            ];

            // This is a confusing construct!
            const tooClosePercent = new Decimal(REFUSE_COLLECTION_TOO_CLOSE_PERCENT).toPercent()

            debug("distanceLower=%s, distanceToUppwer=%s, REFUSE_COLLECTION_TOO_CLOSE_PERCENT=%s.", ...distancesToRanges.map(p=>p.toFixed(2)), tooClosePercent.quotient);

            // See if any is too close to ut of range
            const indexTooCloseOutOfRange = distancesToRanges.findIndex(distance => distance.lessThan(tooClosePercent));

            // Too close?
            if (indexTooCloseOutOfRange != -1) {
                logger.warn("We are too close (%s%%) in the threshold (%s%%). Refusing to collect.",
                    distancesToRanges[indexTooCloseOutOfRange].toFixed(2),
                    tooClosePercent.quotient
                );
                continue;
            }

            // First trigger collection
            logger.debug("Collecting rewards.");

            const shouldTriggerRedeposit = await collectFees(positionInfo);

            if (shouldTriggerRedeposit) {
                // Now redeposit
                logger.debug("Re-depositing.");

                dbPosition.redepositAttemptsRemaining = 1;
                await dbPosition.save();
            }
            else
                debug("Refusing to trigger redeposit.");
        }
        else {
            debug("No fee collection conditions met.");
        }
    }
}