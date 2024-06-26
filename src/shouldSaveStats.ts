
import { addHours } from 'date-fns';
import Debug from 'debug';
import Decimal from 'decimal.js';
import { SAVE_STATS_EVERY_HOURS, TAKE_PROFIT_PERCENT, USDC_TOKEN, WANTED_FEE_AMOUNT, WETH_TOKEN } from './constants';
import { DBProperty } from './database';
import { DBPositionHistory } from './database/models/DBPositionHistory';
import { DBStat } from './database/models/DBStat';
import BalanceHelpers from './helpers/BalanceHelpers';
import PoolHelper from './helpers/PoolHelper';
import { PositionInfo } from "./helpers/PositionManager";
import PriceHelper from './helpers/PriceHelper';
import { EMA_DELIMETER, LAST_PERCENT_EMA_KEY } from './sendHeartbeatAlerts';

const debug = Debug("unibalancer:shouldSaveStats");

const NEXT_SAVE_STAT_KEY = "NextTimeToSaveStats";

export default async function (positionInfos: PositionInfo[]) {
    // Right NOW!
    const now = new Date();

    // Get the last heartbeat time
    const nextTimeToSaveStats = await DBProperty.getByKey(NEXT_SAVE_STAT_KEY);

    debug("nextTimeToSaveStats=%s", nextTimeToSaveStats?.value);

    // Is it time?
    if (nextTimeToSaveStats != null && now < new Date(nextTimeToSaveStats.value)) {
        debug("Not time save the stats.");
        return;
    }

    // Get the price from the pewl we are using
    const poolInfo = await PoolHelper.getWethUsdcPoolInfo(WANTED_FEE_AMOUNT);
    const price = PriceHelper.sqrtRatioX96ToPrice(WETH_TOKEN, USDC_TOKEN, poolInfo.sqrtPriceX96);

    // Get the balances
    let [
        currentBalances,
        lastPercentEmaProperty,
        profitTakenTokenA,
        profitTakenTokenB,
        feesReceivedTokenA,
        feesReceivedTokenB,
        totalPositions,
        deficitsTokenA,
        deficitsTokenB,
        currentDeficitToken0,
        currentDeficitToken1,
        avgPositionTimeInHours,
    ] = await Promise.all([
        BalanceHelpers.adjustedWethUsdcBalanceAsCurrencyAmount(),
        DBProperty.getByKey(LAST_PERCENT_EMA_KEY),
        DBProperty.getCumulativeTokenHoldings("weth"),
        DBProperty.getCumulativeTokenHoldings("usdc"),
        DBProperty.getCumulativeFeesReceived("weth"),
        DBProperty.getCumulativeFeesReceived("usdc"),
        DBPositionHistory.count(),
        DBProperty.getCumulativeDefitis("weth"),
        DBProperty.getCumulativeDefitis("usdc"),
        DBProperty.getDeficits("weth"),
        DBProperty.getDeficits("usdc"),
        DBPositionHistory.getAverageTimeInPosition()
    ]);

    // Split these
    let [
        wethBalance,
        usdcBalance,
    ] = currentBalances;

    // The value for EMA default
    let lastPercentEma = new Decimal(0);

    if (lastPercentEmaProperty != null) {
        // Get the last EMA property
        const [, average] = lastPercentEmaProperty.value.split(EMA_DELIMETER) as [string, string];

        // Convert to decimal
        lastPercentEma = new Decimal(average);
    }

    debug("balances before wethBalance=%s, usdcbalance=%s", wethBalance.toFixed(), usdcBalance.toFixed());

    // The total liquidity
    let totalLiquidity = new Decimal(0);

    // Now loop and add them togetta
    for (const { position, tokensOwed0, tokensOwed1 } of positionInfos) {
        // Add the balance in the stake
        wethBalance = wethBalance.add(position.amount0);
        usdcBalance = usdcBalance.add(position.amount1);
        // Add unrealized PnL
        // Unreceived fees
        feesReceivedTokenA = feesReceivedTokenA.add(tokensOwed0);
        feesReceivedTokenB = feesReceivedTokenB.add(tokensOwed1);

        // Chop up our profit
        const profit0 = Decimal.max(0, tokensOwed0.sub(currentDeficitToken0));
        const profit1 = Decimal.max(0, tokensOwed1.sub(currentDeficitToken1));

        // Chop down the deficit
        currentDeficitToken0 = Decimal.max(0, currentDeficitToken0.sub(tokensOwed0));
        currentDeficitToken1 = Decimal.max(0, currentDeficitToken0.sub(tokensOwed1));

        // Unrealized profits
        profitTakenTokenA = profitTakenTokenA.add(profit0.times(TAKE_PROFIT_PERCENT).div(100));
        profitTakenTokenB = profitTakenTokenB.add(profit1.times(TAKE_PROFIT_PERCENT).div(100));

        // Add the liquidity
        totalLiquidity = totalLiquidity.add(position.liquidity.toString());
    }

    // We have more positions
    totalPositions = totalPositions + positionInfos.length;

    // Balance out the profit with the 

    // Calcualte the total usdc value
    const totalValueUsdc = wethBalance.toDecimal().times(price.toDecimal()).plus(usdcBalance.toDecimal());

    debug("balances before wethBalance=%s, usdcbalance=%s, totalValueUsdc=%s", wethBalance, usdcBalance, totalValueUsdc);

    // Save them all
    await DBStat.create({
        tokenABalance: wethBalance.toFixed(),
        tokenBBalance: usdcBalance.toFixed(),
        totalUsdcBalance: totalValueUsdc.toFixed(),
        tokenAPriceInUsdc: price.toFixed(),
        profitTakenTokenA: profitTakenTokenA.toFixed(),
        profitTakenTokenB: profitTakenTokenB.toFixed(),
        feesReceivedTokenA: feesReceivedTokenA.toFixed(),
        feesReceivedTokenB: feesReceivedTokenB.toFixed(),
        totalPositions,
        deficitsTokenA: deficitsTokenA.toFixed(),
        deficitsTokenB: deficitsTokenB.toFixed(),
        avgPositionTimeInHours,
        dailyPercentEma: lastPercentEma.toFixed(),
        totalLiquidity : totalLiquidity.toFixed()
    });

    const nextDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);

    // Last balance saved
    // Set the last heartbeat time
    await DBProperty.upsert({
        key: NEXT_SAVE_STAT_KEY,
        value: nextDate.toISOString()
    });
}