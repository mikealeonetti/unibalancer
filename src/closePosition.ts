import { Percent } from '@uniswap/sdk-core';
import { CollectOptions, Multicall, NonfungiblePositionManager, RemoveLiquidityOptions } from '@uniswap/v3-sdk';
import Debug from 'debug';
import Decimal from 'decimal.js';
import util from 'util';
import { calculateProfitsAndAdjustDeficits } from './collectFees';
import { NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, WITHDRAW_SLIPPAGE } from './constants';
import { DBPosition } from "./database/models/DBPosition";
import { DBPositionHistory } from './database/models/DBPositionHistory';
import BalanceHelpers from './helpers/BalanceHelpers';
import { PositionInfo } from "./helpers/PositionManager";
import TransactionHelper from './helpers/TransactionHelper';
import logger from './logger';
import { userWallet } from './network';
import { alertViaTelegram } from './telegram';

const debug = Debug("unibalancer:closePosition");

export default async function (positionInfo: PositionInfo, dbPosition: DBPosition): Promise<boolean> {
    debug("closePosition", positionInfo, dbPosition);

    try {
        const {
            positionId,
            poolAndPoolInfo,
            tokensOwed0,
            tokensOwed1,
            position
        } = positionInfo;
        const { pool } = poolAndPoolInfo;
        const positionIdString = String(positionId);

        const slippageTolerance = new Decimal(WITHDRAW_SLIPPAGE).div(100).toPercent()

        const expectedCurrencyOwed0 = tokensOwed0.toCurrencyAmount(pool.token0);
        const expectedCurrencyOwed1 = tokensOwed1.toCurrencyAmount(pool.token1);

        debug("expectedCurrencyOwed0=%s, expectedCurrencyOwed1=%s, slippageTolerance=", expectedCurrencyOwed0.toFixed(), expectedCurrencyOwed1.toFixed(), slippageTolerance);

        const collectOptions: Omit<CollectOptions, 'tokenId'> = {
            expectedCurrencyOwed0,
            expectedCurrencyOwed1,
            recipient: userWallet.address,
        }

        debug("collectOptions=", collectOptions);

        const removeLiquidityOptions: RemoveLiquidityOptions = {
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            slippageTolerance,
            tokenId: positionIdString,
            // percentage of liquidity to remove
            liquidityPercentage: new Percent(1),
            collectOptions,
            burnToken : true
        };

        debug("removeLiquidityOptions=", removeLiquidityOptions);

        const { calldata, value } = NonfungiblePositionManager.removeCallParameters(
            positionInfo.position,
            removeLiquidityOptions
        );

        //The return values removeCallParameters are the calldata and value that are needed to construct the transaction to remove liquidity from our position. We can build the transaction and send it for execution:

        const transaction = {
            data: calldata,
            to: NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS,
            value: value,
            from: userWallet.address,
        };

        const clientTransactionResponse = await TransactionHelper.sendTransaction(transaction);

        await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, "closed position");

        // Update the history
        const dbPositionHistory = await DBPositionHistory.getLatestByPositionIdString(positionIdString);

        // Handle things
        const {
            totalProfit0,
            totalProfit1,
            totalProfit0InUSDC
        } = await calculateProfitsAndAdjustDeficits(positionInfo, null, dbPositionHistory);

        const priceAsDecimal = positionInfo.price.toDecimal();

        // Do all of these dumb conversions
        const positionAmount0AsDecimal = position.amount0.toDecimal();
        const positionAmount1AsDecimal = position.amount1.toDecimal();

        // Some calcs for reporting
        const stakeAmountAPriceAsDecimal = positionAmount0AsDecimal.times(priceAsDecimal);
        const totalStakeValueUsdcAsDecimal = stakeAmountAPriceAsDecimal.add(positionAmount1AsDecimal);
        const tokensOwed0InUSDC = tokensOwed0.times(priceAsDecimal);
        const totalTokensOwedInUSDC = tokensOwed1.plus(tokensOwed0InUSDC);

        // Set the history
        if (dbPositionHistory) {
            dbPositionHistory.closed = new Date();
            dbPositionHistory.closedPriceUSDC = totalStakeValueUsdcAsDecimal.toFixed();
            await dbPositionHistory.save();
        }

        // Prepare the text
        const text = util.format(`Closed Position [%s]
        
Opened: %s

Price: %s
Low price: %s (%s%% from current)
High price: %s (%s%% from current)

Fees total: %s USDC (%s%%)
Fees USDC: %s
Fees WETH: %s (%s USDC)

Profits total: %s USDC
Profits USDC: %s
Profits WETH: %s (%s USDC)

Stake total: %s USDC
WETH amount: %s (%s USDC, %s%%)
USDC amount: %s (%s%%)
Liquidity: %s

Last rebalance: %s`,
            positionIdString, dbPosition.createdAt.toLocaleString(), // Created at???

            positionInfo.price.toFixed(4),
            positionInfo.lowerPrice.toFixed(4), positionInfo.price.subtract(positionInfo.lowerPrice).divide(positionInfo.price).multiply(100).toFixed(2),
            positionInfo.upperPrice.toFixed(4), positionInfo.upperPrice.subtract(positionInfo.price).divide(positionInfo.price).multiply(100).toFixed(2),

            totalTokensOwedInUSDC.toFixed(2), totalTokensOwedInUSDC.div(totalStakeValueUsdcAsDecimal).times(100).toFixed(2),
            tokensOwed1.toFixed(2),
            tokensOwed0, tokensOwed0InUSDC.toFixed(2),

            totalProfit0InUSDC.plus(totalProfit1).toFixed(2),
            totalProfit1.toFixed(2),
            totalProfit0, totalProfit0InUSDC,

            totalStakeValueUsdcAsDecimal.toFixed(2),
            position.amount0.toFixed(), stakeAmountAPriceAsDecimal.toFixed(2), stakeAmountAPriceAsDecimal.div(totalStakeValueUsdcAsDecimal).mul(100).toFixed(2),
            position.amount1.toFixed(2), positionAmount1AsDecimal.div(totalStakeValueUsdcAsDecimal).mul(100).toFixed(2),
            position.liquidity,

            dbPosition.lastRewardsCollected ? dbPosition.lastRewardsCollected.toLocaleString() : "Never"
        );

        // Send a heartbeat
        await alertViaTelegram(text);


        // Remove this position from the db
        await dbPosition.destroy();

        logger.info("Position closed [%s]. Fees claimed tokenA=%s, tokenB=%s.",
            positionIdString,
            tokensOwed0,
            tokensOwed1
        );

        // Wrap eth where necessary
        await BalanceHelpers.unwrapEthToMaintainEth();
    }
    catch (e) {
        logger.error("Error closing position [%s].", positionInfo.positionId, e);
        debug("position close error", e);

        return (false);
    }

    return (true);
}