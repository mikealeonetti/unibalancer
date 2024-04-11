import { addMinutes, formatDistance } from "date-fns";
import util from 'util';
import { DBProperty } from "./database";

import Debug from 'debug';
import Decimal from "decimal.js";
import { HEARTBEAT_FREQUENCY_MINUTES } from "./constants";
import { DBPosition } from "./database/models/DBPosition";
import { DBPositionHistory } from "./database/models/DBPositionHistory";
import { PositionInfo } from "./helpers/PositionManager";
import { getSymbolFromTokenAddress } from "./helpers/TokenHelper";
import logger from "./logger";
import { alertViaTelegram } from "./telegram";
import { plusOrMinusStringFromDecimal } from "./utils";
import BalanceHelpers from "./helpers/BalanceHelpers";
import { userWallet } from "./network";
import usdcContract from "./contracts/usdcContract";
import { wethContract } from "./contracts/WethContract";

const debug = Debug("unibalancer:sendHeartbeatAlerts");

const HEARTBEAT_KEY = "lastHeartbeatAlert";

export default async function (positionInfos: PositionInfo[]): Promise<void> {
    // Right NOW!
    const now = new Date();

    // Get the last heartbeat time
    const lastHeartbeat = await DBProperty.getByKey(HEARTBEAT_KEY);

    debug("lastHeartbeat=%s", lastHeartbeat?.value);

    // Is it time?
    if (lastHeartbeat != null && addMinutes(new Date(lastHeartbeat.value), HEARTBEAT_FREQUENCY_MINUTES) > now) {
        debug("Not time to send another heartbeat.");
        return;
    }

    // Get the balances
    const [
        ethBalance,
        wethBalance,
        usdcBalance
    ] = await Promise.all([
        BalanceHelpers.ethBalance(),
        wethContract.balanceOf(userWallet.address),
        usdcContract.balanceOf(userWallet.address),
    ]);
    
    // Loop each position
    for (const positionInfo of positionInfos) {
        const { 
            positionId,
            tokensOwed0,
            tokensOwed1,
            upperPrice,
            lowerPrice,
            position
        } = positionInfo;

        const { pool } = positionInfo.poolAndPoolInfo;
        const positionIdString = String( positionId );

        const token0Symbol = getSymbolFromTokenAddress(pool.token0.address);
        const token1Symbol = getSymbolFromTokenAddress(pool.token1.address);

        // Get from the db
        const [
            dbPosition,
            dbPositionHistory,
            tokenAHoldings,
            tokenBHoldings,
            currentDeficitToken0,
            currentDeficitToken1
        ] = await Promise.all([
            DBPosition.getByPositionIdString(positionIdString),
            DBPositionHistory.getLatestByPositionIdString(positionIdString),
            DBProperty.getTokenHoldings(token0Symbol),
            DBProperty.getTokenHoldings(token1Symbol),
            DBProperty.getDeficits("weth"),
            DBProperty.getDeficits("usdc"),
        ]);

        if (!dbPosition) {
            logger.error("Could not find position [%s] when searching for heartbeat.", positionIdString);
            continue;
        }
        if (!dbPositionHistory) {
            logger.error("Could not find position history [%s] when searching for heartbeat.", positionIdString);
            continue;
        }

        const priceAsDecimal = positionInfo.price.toDecimal();

        // Do all of these dumb conversions
        const positionAmount0AsDecimal = position.amount0.toDecimal();
        const positionAmount1AsDecimal = position.amount1.toDecimal();

        // Fee WETH in USDC
        const tokensOwed0InUsdc = tokensOwed0.times(priceAsDecimal);
        const totalTokensOwedInUsdc = tokensOwed1.plus(tokensOwed0InUsdc);
        const stakeAmountAPrice = positionAmount0AsDecimal.times(priceAsDecimal);
        const totalStakeValueUsdcAsDecimal = stakeAmountAPrice.add(positionAmount1AsDecimal);


        const lastPrice = new Decimal(dbPosition.previousPrice);
        const movementPercent = priceAsDecimal.minus(lastPrice).div(priceAsDecimal).times(100);

        // The last collection date to calcualte from
        const calculateLastDate = dbPosition.lastRewardsCollected || dbPosition.createdAt || now;
        const millisSinceLastDate = now.valueOf() - calculateLastDate.valueOf();
        const hoursSinceLastDate = millisSinceLastDate / (60 * 60 * 1000);
        const percentRewards = totalTokensOwedInUsdc.div(totalStakeValueUsdcAsDecimal).times(100)
        const percentPerHour = percentRewards.div(hoursSinceLastDate);
        const estPercentPerDay = percentPerHour.times(24);

        debug("calculateLastDate=%s, millisSinceLastDate=%s, hoursSinceLastDate=%s, percentPerHour=%s", calculateLastDate, millisSinceLastDate, hoursSinceLastDate, percentPerHour);

        const enteredPriceUSDC = new Decimal( dbPositionHistory.enteredPriceUSDC );
        const previousReceivedFeesTokenA = new Decimal( dbPosition.previousOwedFeesTokenA );
        const previousReceivedFeesTokenB = new Decimal( dbPosition.previousOwedFeesTokenB );
        const previousReceivedFeesTotalUSDC = new Decimal( dbPosition.previousOwedFeesTotalUSDC );
        const distanceFromEnteredPriceUSDC = totalStakeValueUsdcAsDecimal.minus( enteredPriceUSDC ).div( enteredPriceUSDC ).times( 100 );

        const tokenAHoldingsUSDC = tokenAHoldings.times( priceAsDecimal );
        const totalTokenHoldings = tokenAHoldingsUSDC.plus( tokenBHoldings );

        // Save the last price
        await dbPosition.update({ 
            previousPrice: positionInfo.price.toFixed(),
            previousOwedFeesTokenA : tokensOwed0.toString(),
            previousOwedFeesTokenB : tokensOwed1.toString(),
            previousOwedFeesTotalUSDC : totalTokensOwedInUsdc.toString()
        });

        let lastRebalanceString : string = "Never";
        
        if(dbPosition.lastRewardsCollected)
            lastRebalanceString = `${dbPosition.lastRewardsCollected.toLocaleString()} (${formatDistance( dbPosition.lastRewardsCollected, now )})`

        // Prepare the text
        const text = util.format(`Position [%s]
        
Opened: %s (%s)

Price: %s (%s%%)
Low price: %s (%s%% from current)
High price: %s (%s%% from current)

Rewards total: %s USDC (%s%%, %s)
Rewards USDC: %s (%s)
Rewards WETH: %s (%s USDC, %s)
Est Per Day: %s%%

Stake total: %s USDC (%s%% from entry)
WETH amount: %s (%s USDC, %s%%)
USDC amount: %s (%s%%)

Last rebalance: %s

Owed WETH: %s
Owed USDC: %s

Profit Taken Total: %s USDC
Profit Taken WETH: %s (%s USDC)
Profit Taken USDC: %s

Wallet ETH: %s (%s USDC)
Wallet WETH: %s (%s USDC)
Wallet USDC: %s`,
            // Position key
            positionIdString,
            
            // Created
            dbPosition.createdAt.toLocaleString(), formatDistance(dbPosition.createdAt, now),

            // Price
            positionInfo.price.toFixed(4), plusOrMinusStringFromDecimal( movementPercent, 2 ),
            lowerPrice.toFixed(4), positionInfo.price.subtract(lowerPrice).divide(positionInfo.price).multiply(100).toFixed(2),
            upperPrice.toFixed(4), upperPrice.subtract(positionInfo.price).divide(positionInfo.price).multiply(100).toFixed(2),

            // Rewards total
            totalTokensOwedInUsdc.toFixed(2), percentRewards.toFixed(2), plusOrMinusStringFromDecimal( totalTokensOwedInUsdc.minus( previousReceivedFeesTotalUSDC ), 2 ),
            tokensOwed1.toFixed(2), plusOrMinusStringFromDecimal( tokensOwed1.minus( previousReceivedFeesTokenB ), 2 ),
            tokensOwed0, tokensOwed0InUsdc.toFixed(2), plusOrMinusStringFromDecimal( tokensOwed0.minus( previousReceivedFeesTokenA ) ),
            estPercentPerDay.toFixed(2),

            // Stake total
            totalStakeValueUsdcAsDecimal.toFixed(2), plusOrMinusStringFromDecimal( distanceFromEnteredPriceUSDC, 2 ),
            position.amount0.toFixed(), stakeAmountAPrice.toFixed(2), stakeAmountAPrice.div(totalStakeValueUsdcAsDecimal).mul(100).toFixed(2),
            position.amount1.toFixed(2), positionAmount1AsDecimal.div(totalStakeValueUsdcAsDecimal).mul(100).toFixed(2),

            // Last rebalance
            lastRebalanceString,

            // Current deficits
            currentDeficitToken0.toFixed(),
            currentDeficitToken1.toFixed(2),

            // Latest profits
            totalTokenHoldings.toFixed(2),
            tokenAHoldings, tokenAHoldingsUSDC.toFixed(2),
            tokenBHoldings.toFixed(2),

            // Wallet balances
            ethBalance, ethBalance.times(priceAsDecimal).toFixed(2),
            wethBalance, wethBalance.times(priceAsDecimal).toFixed(2),
            usdcBalance.toFixed(2)
        );

        // Send a heartbeat
        await alertViaTelegram(text);
    }

    // Set the last heartbeat time
    await DBProperty.upsert({
        key: HEARTBEAT_KEY,
        value: now.toISOString()
    });
}