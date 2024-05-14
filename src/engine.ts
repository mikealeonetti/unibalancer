import Bluebird from "bluebird";
import { clone, find, isEmpty } from "lodash";
import closeOutOfRangePositions from "./closeOutOfRangePositions";
import logger from "./logger";
import resyncDatabasePositions from "./resyncDatabasePositions";

import Debug from 'debug';
import PromiseQueue from "./PromiseQueue";
import checkForPositionsNeedingRedeposit from "./checkForPositionsNeedingRedeposit";
import closePosition from "./closePosition";
import { TOLERANCE_IN_MINUTES, USDC_TOKEN, WANTED_FEE_AMOUNT, WETH_TOKEN } from "./constants";
import { DBPosition } from "./database/models/DBPosition";
import PoolHelper from "./helpers/PoolHelper";
import PositionManager, { PositionInfo } from "./helpers/PositionManager";
import sendHeartbeatAlerts from "./sendHeartbeatAlerts";
import shouldSaveStats from "./shouldSaveStats";
import shouldTriggerRedeposit from "./shouldTriggerRedeposit";
import PriceHelper from "./helpers/PriceHelper";

const debug = Debug("unibalancer:engine");

export default class Engine {
    /**
     * Our last positions
     */
    private openPositions: PositionInfo[] = [];

    /**
     * Our queue
     */
    private promiseQueue = new PromiseQueue();

    /**
     * Close a position and re-open a new one
     * @param positionId 
     */
    async closeAndReOpenPosition(positionId: bigint): Promise<boolean> {
        // Re-get positions to re-fresh
        const [
            currentPositions,
            dbPosition
        ] = await Promise.all([
            PositionManager.getAllPositions(),
            DBPosition.getByPositionId(positionId)
        ]);

        // Get the position we want
        const positionInfo = find(currentPositions, { positionId });

        if (!positionInfo) {
            logger.warn("Wanted to close position [%s] via tick but was not found on the blockchain.", positionId);
            return false;
        }
        if (!dbPosition) {
            logger.warn("Wanted to close position [%s] via tick but was not found in the database.", positionId);
            return false;
        }

        // Close it
        const positionClosed = await closePosition(positionInfo, dbPosition);

        // Did the position close?
        if (!positionClosed) {
            logger.warn("Failed to close open position [%s].", positionId);
            return false;
        }

        // Do we have more positions?
        // Current positions should only be one
        if (currentPositions.length > 1) {
            logger.warn("Want to open a new position but there is already one open in swap event.");
            return false;
        }

        logger.info("Looking to open a new position in swap event.");

        // Open a new position
        await PositionManager.mintOrIncreasePosition();

        logger.info("New position opened in swap event.");

        return true;
    }

    /**
     * The tick event
     */
    async swapEvent(sender: string,
        recipient: string,
        amount0: bigint,
        amount1: bigint,
        sqrtPriceX96: bigint,
        liquidity: bigint,
        tick: bigint): Promise<void> {
        try {
            // Get as a regular nambaa
            const tickCurrent = Number(tick);

            // Shallow copy of open positions
            const openPositions = clone(this.openPositions);

            // Should we refresh after
            let refreshPositionsAfter = false;

            // Loop the open positions
            for (const positionInfo of openPositions) {
                const { tickLower, tickUpper, positionId } = positionInfo;

                const price = PriceHelper.sqrtRatioX96ToPrice(WETH_TOKEN, USDC_TOKEN, sqrtPriceX96);

                // Is it out of range
                const isOutOfRange = tickCurrent <= tickLower || tickCurrent >= tickUpper;

                debug("onSwapEvent price=%s, tickCurrent=%s, tickLower=%s, tickUpper=%s, isOutOfRange=%s", price.toFixed(), tickCurrent, tickLower, tickUpper, isOutOfRange);

                // Is the position out of range???
                if (isOutOfRange) {
                    logger.info("Currrent position [%s] is out of range on event. Triggering close and rebalance.", positionId);

                    // Close and don't wait
                    refreshPositionsAfter ||= await this.closeAndReOpenPosition(positionId);
                }
            }

            // Get new positions?
            if (refreshPositionsAfter)
                this.openPositions = await PositionManager.getAllPositions();
        }
        catch (e) {

            logger.error("Error swap event.", e);
        }
    }

    /**
     * Swap event handler
     */
    onSwapEvent = (...args: [string, string, bigint, bigint, bigint, bigint, bigint]) => {
        this.promiseQueue.queue(
            () => this.swapEvent(...args)
        );
    };

    /**
     * Subscribe to get tick alerts from the pool
     */
    subscribeToPool() {
        // Get the pool
        const wantedPool = PoolHelper.getWethUsdcPool(WANTED_FEE_AMOUNT);

        // Subscribe to the teck in the queue
        wantedPool.on("Swap", this.onSwapEvent);
    }

    // Run the minute
    runMinute = async (): Promise<void> => {
        try {
            debug("minute executed");
            // Get all open positions
            this.openPositions = await PositionManager.getAllPositions();

            debug("openPositions=", this.openPositions);

            // Cross check the database
            await resyncDatabasePositions(this.openPositions);

            // Close any positions out of range
            this.openPositions = await closeOutOfRangePositions(this.openPositions);

            //debug( "New open positions=", openPositions );

            // Send heartbeats
            // This should probably go after
            await sendHeartbeatAlerts(this.openPositions);

            // Save balances
            await shouldSaveStats(this.openPositions);

            // Do we have to trigger a re-deposit?
            await shouldTriggerRedeposit(this.openPositions);

            // Do we have no more positions open?
            if (isEmpty(this.openPositions)) {
                logger.info("No positions open. Attempting to open another one.");

                await PositionManager.mintOrIncreasePosition();
            }

            // Do we have any positions that need to be redeposited
            await checkForPositionsNeedingRedeposit(this.openPositions);
        }
        catch (e) {
            logger.error("Error running minute.", e);
        }
    }


    /**
     * Main runner
     */
    async run(): Promise<void> {
        // Subscribe to the pool for immediate swaps
        if( TOLERANCE_IN_MINUTES==0 )
            this.subscribeToPool(); // If no tolerance is specified then we need immediate re-balancing

        // The main async event loop
        while (true) {
            // Run it
            await this.promiseQueue.queue(this.runMinute);

            // 1 minute
            await Bluebird.delay(60 * 1000);
        }
    }
}