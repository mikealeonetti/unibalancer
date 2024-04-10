import util from 'util';

import { CollectOptions, NonfungiblePositionManager } from "@uniswap/v3-sdk";
import Debug from 'debug';
import { NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, TAKE_PROFIT_PERCENT } from "./constants";
import { DBProperty } from "./database";
import { DBPosition } from "./database/models/DBPosition";
import { DBPositionHistory } from "./database/models/DBPositionHistory";
import { PositionInfo } from "./helpers/PositionManager";
import { getSymbolFromTokenAddress } from "./helpers/TokenHelper";
import TransactionHelper from "./helpers/TransactionHelper";
import logger from "./logger";
import { userWallet } from "./network";
import { alertViaTelegram } from "./telegram";
import Decimal from 'decimal.js';
import BalanceHelpers from './helpers/BalanceHelpers';

const debug = Debug("unibalancer:engine");

interface CalculateProfitsAndAdjustDeficitsReturn {
    totalProfit0InUSDC: Decimal;
    totalProfit0: Decimal;
    totalProfit1: Decimal;
}

export async function calculateProfitsAndAdjustDeficits(
    positionInfo: PositionInfo,
    dbPosition: DBPosition | null,
    dbPositionHistory: DBPositionHistory | null
): Promise<CalculateProfitsAndAdjustDeficitsReturn> {
    const { tokensOwed0, tokensOwed1, poolAndPoolInfo, positionId } = positionInfo;

    //tokensOwed0 = new Decimal( 0.5 );
    //tokensOwed1 = new Decimal( 100 );

    const positionIdString = String( positionId );

    if (dbPosition) {
        dbPosition.lastRewardsCollected = new Date();

        // Reset these
        dbPosition.previousOwedFeesTokenA = "0";
        dbPosition.previousOwedFeesTokenB = "0";
        dbPosition.previousOwedFeesTotalUSDC = "0";

        // Save it
        await dbPosition.save();
    }
    if (dbPositionHistory) {
        dbPositionHistory.receivedFeesTokenA = tokensOwed0.plus(dbPositionHistory.receivedFeesTokenA).toString();
        dbPositionHistory.receivedFeesTokenB = tokensOwed1.plus(dbPositionHistory.receivedFeesTokenA).toString();

        await dbPositionHistory.save();
    }

    // Get the symbols
    const [symbol0, symbol1] = [
        getSymbolFromTokenAddress(poolAndPoolInfo.pool.token0.address),
        getSymbolFromTokenAddress(poolAndPoolInfo.pool.token1.address),
    ];

    // Payback the deficits
    const [profit0, profit1] = await Promise.all([
        DBProperty.paybackDeficits(symbol0, tokensOwed0),
        DBProperty.paybackDeficits(symbol1, tokensOwed1),
    ]);

    debug("before tokensOwed1=%s, profitB=%s, profit0=%s, profit1=%s", tokensOwed0, tokensOwed1, profit0, profit1);

    const totalProfit0 = profit0.times(TAKE_PROFIT_PERCENT).div(100);
    const totalProfit1 = profit1.times(TAKE_PROFIT_PERCENT).div(100);

    debug("totalProfit0=%s, totalProfit1=%s", totalProfit0, totalProfit1);

    // Add the rewards to our holdings
    await Promise.all([
        DBProperty.addTokenHoldings(symbol0, totalProfit0, positionIdString),
        DBProperty.addTokenHoldings(symbol1, totalProfit1, positionIdString),
    ]);

    // Profit in WETH
    const totalProfit0InUSDC = totalProfit0.times(positionInfo.price.toDecimal());

    return ({
        totalProfit0InUSDC,
        totalProfit0,
        totalProfit1
    });
}

export default async function collectFees(positionInfo: PositionInfo): Promise<void> {
    const { positionId, tokensOwed0, tokensOwed1, poolAndPoolInfo } = positionInfo;
    const positionIdString = String(positionId);

    const collectOptions: CollectOptions = {
        tokenId: positionIdString,
        expectedCurrencyOwed0: tokensOwed0.toCurrencyAmount(poolAndPoolInfo.pool.token0),
        expectedCurrencyOwed1: tokensOwed1.toCurrencyAmount(poolAndPoolInfo.pool.token1),
        recipient: userWallet.address,
    };

    const { calldata, value } =
        NonfungiblePositionManager.collectCallParameters(collectOptions)

    //The function above returns the calldata and value required to construct the transaction for collecting accrued fees. Now that we have both the calldata and value we needed for the transaction, we can build and execute the it:

    const transaction = {
        data: calldata,
        to: NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS,
        value: value,
        from: userWallet.address
    };

    const clientTransactionResponse = await TransactionHelper.sendTransaction(transaction);

    // Feel good about feeing good
    await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, "collected rewards");

    logger.info("Collected rewards [%s]. tokenA=%s, tokenB=%s.", positionIdString, tokensOwed0, tokensOwed1);

    // We successfully claimed these rewards.
    // Tell our souls
    const [
        dbPositionHistory,
        dbPosition
    ] = await Promise.all([
        DBPositionHistory.getLatestByPositionIdString(positionIdString),
        DBPosition.getByPositionIdString(positionIdString)
    ]);

    // Calculate the profites
    const {
        totalProfit0,
        totalProfit1,
        totalProfit0InUSDC
    } = await calculateProfitsAndAdjustDeficits(positionInfo, dbPosition, dbPositionHistory);

    // Prepare the text
    const text = util.format(`Claimed rewards [%s]
        
WETH: %s (%s USDC)
USDC: %s

Profits total: %s USDC
Profits USDC: %s
Profits WETH: %s (%s USDC)`,
        positionIdString,

        tokensOwed0, tokensOwed0.times(positionInfo.price.toDecimal()).toFixed(2),
        tokensOwed1.toFixed(2),

        totalProfit0InUSDC.plus(totalProfit1).toFixed(2),
        totalProfit1.toFixed(2),
        totalProfit0, totalProfit0InUSDC.toFixed(2),
    );

    // Send a heartbeat
    await alertViaTelegram(text);

    // Wrap eth where necessary
    await BalanceHelpers.unwrapEthToMaintainEth();
}