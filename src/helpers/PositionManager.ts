import { Price, Token } from "@uniswap/sdk-core";
import { AddLiquidityOptions, MintOptions, NonfungiblePositionManager, Pool, Position, nearestUsableTick, priceToClosestTick, tickToPrice } from "@uniswap/v3-sdk";
import { addMinutes } from "date-fns";
import { first, round, times } from "lodash";
import util from 'util';
import { DEPOSIT_SLIPPAGE, MAX_CONCURRENCY, NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS, RANGE_PERCENT, USDC_TOKEN, V3_SWAP_ROUTER_ADDRESS, WANTED_FEE_AMOUNT, WETH_TOKEN } from "../constants";
import { wethContract } from "../contracts/WethContract";
import usdcContract from "../contracts/usdcContract";
import { userWallet } from "../network";
import DecimalUtil from "./DecimalUtil";
import PoolHelper, { PoolAndPoolInfo, PoolInfo } from "./PoolHelper";
import TransactionHelper from "./TransactionHelper";

import { Currency, CurrencyAmount } from "@uniswap/sdk-core/dist/entities";
import Bluebird from "bluebird";
import Debug from 'debug';
import Decimal from "decimal.js";
import Erc20Contract from "../contracts/Erc20Contract";
import nftTokenContract from "../contracts/nftTokenContract";
import { DBPosition } from "../database/models/DBPosition";
import { DBPositionHistory } from "../database/models/DBPositionHistory";
import logger from "../logger";
import swapToken from "../swapToken";
import { alertViaTelegram } from "../telegram";
import BalanceHelpers from "./BalanceHelpers";
import LiquidityCalc from "./LiquidityCalc";
import PriceHelper from "./PriceHelper";

const debug = Debug("unibalancer:helpers:PositionManager");

export enum GetPositionsType {
    ReallyAll,
    HasLiquidity,
    HasNoLiquidity
}

export interface TickUpperAndLower {
    tickUpper: number;
    tickLower: number;
}

export interface PositionInfo {
    upperPrice: Price<Token, Token>;
    lowerPrice: Price<Token, Token>;
    price: Price<Token, Token>;
    poolAndPoolInfo: PoolAndPoolInfo;
    positionId: bigint;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    feeGrowthInside0LastX128: bigint;
    feeGrowthInside1LastX128: bigint;
    tokensOwed0: Decimal;
    tokensOwed1: Decimal;
    position: Position;
}
export default class PositionManager {

    static readonly MAX_UINT128 = new Decimal(2).pow(128).sub(1).toBigIntString(0);

    static calculateTicks(poolInfo: PoolInfo): TickUpperAndLower {
        //const tickPrice = tickToPrice(WETH_TOKEN, USDC_TOKEN, poolInfo.tick);
        //const realPrice = ( BigInt( poolInfo.sqrtPriceX96.toString() ) / BigInt( 2**96 ) ) ** BigInt( 2 );
        const realPrice = PriceHelper.sqrtRatioX96ToPrice(WETH_TOKEN, USDC_TOKEN, poolInfo.sqrtPriceX96);

        debug("realPrice=%s", realPrice.toFixed());

        debug("poolInfo.sqrtPriceX96.toString()=%s", poolInfo.sqrtPriceX96.toString());

        //debug( "tickPrice=%s, realPrice=%s", tickPrice.toFixed(), realPrice.toFixed() );

        const halfRange = new Decimal(RANGE_PERCENT).div(2);
        const upFraction = new Decimal(100).plus(halfRange).div(100);
        const downFraction = new Decimal(100).minus(halfRange).div(100);

        debug("halfRange=%s", halfRange);

        //const priceAsDecimal = realPrice.toDecimal();

        // Up and down
        //const tickPriceAsDecimalUp = priceAsDecimal.times( 100+halfRange ).div(100);
        //const tickPriceAsDecimalDowm = priceAsDecimal.times( 100-halfRange ).div(100);

        //Test
        const tickPriceAsFractionUp = realPrice.asFraction.multiply(
            upFraction.toPercent()
        );
        const tickPriceAsFractionDown = realPrice.asFraction.multiply(
            downFraction.toPercent()
        );

        const upPriceTest = new Price(
            realPrice.baseCurrency,
            realPrice.quoteCurrency,
            tickPriceAsFractionUp.denominator,
            tickPriceAsFractionUp.numerator
        );
        const downPriceTest = new Price(
            realPrice.baseCurrency,
            realPrice.quoteCurrency,
            tickPriceAsFractionDown.denominator,
            tickPriceAsFractionDown.numerator
        );

        const upPrice = new Price(
            realPrice.baseCurrency,
            realPrice.quoteCurrency,
            tickPriceAsFractionUp.denominator,
            tickPriceAsFractionUp.numerator
        );
        const downPrice = new Price(
            realPrice.baseCurrency,
            realPrice.quoteCurrency,
            tickPriceAsFractionDown.denominator,
            tickPriceAsFractionDown.numerator
        );

        debug("other upPrice=%s, downPrice=%s", upPrice.toFixed(), downPrice.toFixed());

        const uptick = priceToClosestTick(upPrice);

        debug("pricecClosest=%s", uptick);

        debug("andBack=%s", tickToPrice(WETH_TOKEN, USDC_TOKEN, uptick).toFixed());

        const downtick = priceToClosestTick(downPrice);

        debug("pricecClosest=%s", downtick);

        debug("andBack=%s", tickToPrice(WETH_TOKEN, USDC_TOKEN, downtick).toFixed());


        const nearestTickLower = nearestUsableTick(downtick, poolInfo.tickSpacing);
        const nearestTickUpper = nearestUsableTick(uptick, poolInfo.tickSpacing);

        debug("constructPosition nearestTickLower=%s, nearstTickUpper=%s", nearestTickLower, nearestTickUpper);

        return ({
            tickUpper: nearestTickUpper,
            tickLower: nearestTickLower
        });
    }

    private static async constructPlaceholderPosition(pool: Pool, tickLower: number, tickUpper: number): Promise<Position> {
        const placeholderPosition = new Position({
            pool,
            liquidity: 1,
            tickLower,
            tickUpper
        });

        return (placeholderPosition);

        // create position using the maximum liquidity from input amounts
        /*
        return Position.fromAmounts({
            pool: configuredPool,
            tickLower: nearestUsableTick(tickLower, poolInfo.tickSpacing),
            tickUpper: nearestUsableTick(tickUpper, poolInfo.tickSpacing),
            amount0: token0Amount.quotient,
            amount1: token1Amount.quotient,
            useFullPrecision: true,
        })
        */
    }

    public static async approveAllowances(wethAmountWanted: CurrencyAmount<Currency>, usdcAmountWanted: CurrencyAmount<Currency>): Promise<void> {
        const contracts = [
            ["weth", wethContract, wethAmountWanted.toDecimal()],
            ["usdc", usdcContract, usdcAmountWanted.toDecimal()]
        ] as [string, Erc20Contract, Decimal][];
        const spenderAddresses = [
            ["nftp", NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS],
            ["swap router", V3_SWAP_ROUTER_ADDRESS]
        ];

        // Check the allowance
        for (const [spenderName, spenderAddress] of spenderAddresses) {
            for (const [contractName, contract, amountWanted] of contracts) {
                const hasEnoughAllowance = await contract.hasEnoughAllowance(userWallet.address, spenderAddress, amountWanted);

                debug("mintNewPosition contract [%s] hasEnoughAllowance=%s", contract, hasEnoughAllowance);

                if (!hasEnoughAllowance) {
                    debug("mintNewPosition approving contract [%s] for spenderAddress", contract, spenderAddress);

                    const clientTransactionResponse = await contract.approve(spenderAddress);

                    await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, `approve ${contractName} on ${spenderName}.`);

                    debug("mintNewPosition approved");
                }
            }
        }
    }

    static async mintOrIncreasePosition(positionInfo?: PositionInfo): Promise<void> {
        // Do we have a previous position
        const hasPreviousPosition = positionInfo != null;

        // Make sure we wrap the eth we need
        await BalanceHelpers.wrapEthToMaintainWeth();

        // Get the pool
        const {
            pool,
            poolInfo
        } = await PoolHelper.getWethUsdcPoolAndPoolinfo(WANTED_FEE_AMOUNT);

        // Get the tecks
        let tickUpperAndLower: TickUpperAndLower;

        // Use the previous ticks if we have them
        if (hasPreviousPosition)
            tickUpperAndLower = { tickUpper: positionInfo.tickUpper, tickLower: positionInfo.tickLower };
        else
            tickUpperAndLower = this.calculateTicks(poolInfo);

        // Get the position
        const placeholderPosition = await this.constructPlaceholderPosition(pool, tickUpperAndLower.tickLower, tickUpperAndLower.tickUpper);

        // Get our balances
        let [wethBalance, usdcBalance] = await BalanceHelpers.adjustedWethUsdcBalanceAsCurrencyAmount();

        // Do we have enough?
        {
            const haveEnough = wethBalance.greaterThan(0) || usdcBalance.greaterThan(0);

            // Do we have enough to deposit?
            // Do we have any money whatsoever?
            if (!haveEnough) {
                logger.warn("Cannot open a position. Not enough spendable amount. spendableA=%s, spendableB=%s.", wethBalance.toFixed(), usdcBalance.toFixed());
                return;
            }
        }

        // Get the amount we have to swap
        const { amountToSwap, swapPool } = await LiquidityCalc.getRatio(
            wethBalance,
            usdcBalance,
            placeholderPosition.tickUpper,
            placeholderPosition.tickLower,
            placeholderPosition.pool
        );

        // Do we have to swap?
        if (amountToSwap.greaterThan(0)) {
            debug("We need to swap %s of token %s", amountToSwap.toFixed(), amountToSwap.currency.name);

            const [tokenToSwapFrom, tokenToSwapTo] = amountToSwap.currency.equals(WETH_TOKEN) ? [WETH_TOKEN, USDC_TOKEN] : [USDC_TOKEN, WETH_TOKEN];
            const amountToSwapDecimal = DecimalUtil.fromCurrencyAmount(amountToSwap);

            debug("tokenToSwapTo=%s, amountToSwapDecimal=%s", tokenToSwapTo.name, amountToSwapDecimal);

            // Swap now
            await swapToken(tokenToSwapFrom, tokenToSwapTo, amountToSwapDecimal, swapPool.fee);

            // Re-get the balances
            [wethBalance, usdcBalance] = await BalanceHelpers.adjustedWethUsdcBalanceAsCurrencyAmount();
        }

        // Check again
        // Do we have enough?
        {
            const haveEnough = wethBalance.greaterThan(0) && usdcBalance.greaterThan(0);

            // Do we have enough to deposit?
            // Do we have any money whatsoever?
            if (!haveEnough) {
                logger.warn("Cannot open a position AFTER SWAPPING. Not enough spendable amount. spendableA=%s, spendableB=%s.", wethBalance.toFixed(), usdcBalance.toFixed());
                return;
            }
        }

        // Make sure we're approved
        await this.approveAllowances(wethBalance, usdcBalance);

        // Get the slippage
        const depositSlippage = new Decimal(DEPOSIT_SLIPPAGE).div(100).toPercent();

        debug("mintNewPosition depositSlippage=%s", depositSlippage.toFixed());

        const deadline = round(addMinutes(new Date(), 20).valueOf() / 1000);

        let mintOrIncreaseOptions: AddLiquidityOptions;

        if (hasPreviousPosition) {
            mintOrIncreaseOptions = {
                deadline,
                slippageTolerance: depositSlippage,
                tokenId: positionInfo.positionId.toString(),
            };

            debug("mintNewPosition increaseOptions=", mintOrIncreaseOptions);
        }
        else {
            const mintOptions: MintOptions = {
                recipient: userWallet.address,
                deadline,
                slippageTolerance: depositSlippage,
            };

            debug("mintNewPosition mintOptions=", mintOptions);

            mintOrIncreaseOptions = mintOptions;
        }

        // Do we have to add the amounts?
        if (hasPreviousPosition) {
            debug("before wethBalance=%s,usdcBalance=%s", wethBalance.quotient, usdcBalance.quotient);

            // Do we REALLY have to do this?
            //wethBalance = wethBalance.add( positionInfo.position.amount0 );
            //usdcBalance = usdcBalance.add( positionInfo.position.amount1 );
        }

        debug("after wethBalance=%s,usdcBalance=%s", wethBalance.toFixed(), usdcBalance.toFixed());

        const positionToMintOrIncrease = Position.fromAmounts({
            pool,
            tickLower: tickUpperAndLower.tickLower,
            tickUpper: tickUpperAndLower.tickUpper,
            amount0: wethBalance.quotient,
            amount1: usdcBalance.quotient,
            useFullPrecision: true
        });

        // Get all positions before
        const positionIdsBefore = hasPreviousPosition ? null :
            await this.getAllPositionIds();

        // get calldata for minting a position
        const { calldata, value } = NonfungiblePositionManager.addCallParameters(
            positionToMintOrIncrease,
            mintOrIncreaseOptions
        );

        // build transaction
        const transaction = {
            data: calldata,
            to: NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS,
            value: value,
            from: userWallet.address,
        };

        debug("mintNewPosition transaction=", transaction);

        const clientTransactionResponse = await TransactionHelper.sendTransaction(transaction)

        await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, "mint position");

        let dbPosition: DBPosition | null = null;
        let textToSendViaTelegram: string | null = null;

        // Now manage the database
        if (positionIdsBefore != null) {
            // Get the new position ID
            const positionsAfter = await this.getAllPositions();

            // Get the difference
            const newPositions = positionsAfter.filter(positionInfo => positionIdsBefore.findIndex(positionId => positionId == positionInfo.positionId) == -1);

            debug("newPositions=", newPositions);

            // Get the first
            const newPositionInfo = first(newPositions);

            debug("newPositionInfo=", newPositionInfo);

            // Create a new position
            if (newPositionInfo) {
                const newPositionIdString = newPositionInfo.positionId.toString();

                logger.info("Position opened [%s],", newPositionIdString);

                const price = PriceHelper.sqrtRatioX96ToPrice(
                    pool.token0,
                    pool.token1,
                    BigInt(pool.sqrtRatioX96.toString())
                );

                debug("newPositionInfo previousPrice=", price);

                dbPosition = new DBPosition({
                    positionId: newPositionIdString,
                    previousPrice: price.toFixed()
                });

                // Do all of these dumb conversions
                const positionAmount0AsDecimal = newPositionInfo.position.amount0.toDecimal();
                const positionAmount1AsDecimal = newPositionInfo.position.amount1.toDecimal();
                const priceAsDecimal = newPositionInfo.price.toDecimal();

                const stakeAmountAPrice = positionAmount0AsDecimal.mul(priceAsDecimal);
                const totalStakeValueUSDC = stakeAmountAPrice.add(positionAmount1AsDecimal);

                await DBPositionHistory.create({
                    positionId: newPositionIdString,
                    enteredPriceUSDC: totalStakeValueUSDC.toString(),
                    liquidityAtOpen: newPositionInfo.liquidity.toString()
                });

                // Prepare the text
                textToSendViaTelegram = util.format(`New Position [%s]

Price: %s
Low price: %s (%s%% from current)
High price: %s (%s%% from current)

Stake total: %s USDC
WETH amount: %s (%s USDC, %s%%)
USDC amount: %s (%s%%)
Liquidity: %s`,
                    newPositionIdString,

                    newPositionInfo.price.toFixed(4),
                    newPositionInfo.lowerPrice.toFixed(4), newPositionInfo.price.subtract(newPositionInfo.lowerPrice).divide(newPositionInfo.price).multiply(100).toFixed(2),
                    newPositionInfo.upperPrice.toFixed(4), newPositionInfo.upperPrice.subtract(newPositionInfo.price).divide(newPositionInfo.price).multiply(100).toFixed(2),

                    totalStakeValueUSDC.toFixed(2),
                    newPositionInfo.position.amount0.toFixed(), stakeAmountAPrice.toFixed(2), stakeAmountAPrice.div(totalStakeValueUSDC).mul(100).toFixed(2),
                    newPositionInfo.position.amount1.toFixed(2), positionAmount1AsDecimal.div(totalStakeValueUSDC).mul(100).toFixed(2),
                    newPositionInfo.position.liquidity
                );
            }
            else
                logger.warn("Position opened but cannot obtain it.");
        }
        else if (hasPreviousPosition) {
            const { positionId } = positionInfo;
            const positionIdString = String(positionInfo.positionId);

            // Pull the old
            dbPosition = await DBPosition.getByPositionIdString(positionIdString);

            // Re-get positions
            const positionsAfter = await this.getAllPositions();

            // Get the new position
            const newPositionInfo = positionsAfter.find(positionAfterInfo => positionAfterInfo.positionId == positionId);

            if (newPositionInfo != null) {
                // Do all of these dumb conversions
                const priceAsDecimal = newPositionInfo.price.toDecimal();

                // Old info
                const oldPositionAmount0AsDecimal = positionInfo.position.amount0.toDecimal();
                const oldPositionAmount1AsDecimal = positionInfo.position.amount1.toDecimal();
                
                const oldStakeAmountAPrice = oldPositionAmount0AsDecimal.mul(priceAsDecimal);
                const oldTotalStakeValueUSDC = oldStakeAmountAPrice.add(oldPositionAmount1AsDecimal);

                // New info
                const newPositionAmount0AsDecimal = newPositionInfo.position.amount0.toDecimal();
                const newPositionAmount1AsDecimal = newPositionInfo.position.amount1.toDecimal();
                
                const newStakeAmountAPrice = newPositionAmount0AsDecimal.mul(priceAsDecimal);
                const newTotalStakeValueUSDC = newStakeAmountAPrice.add(newPositionAmount1AsDecimal);

                logger.info("Position increased [%s],", positionIdString);

                // Prepare the text
                textToSendViaTelegram = util.format(`Position Increased [%s]

Price: %s
Low price: %s (%s%% from current)
High price: %s (%s%% from current)

Old Stake total: %s USDC
Old WETH amount: %s (%s USDC, %s%%)
Old USDC amount: %s (%s%%)
Old liquidity: %s

New Stake total: %s USDC
New WETH amount: %s (%s USDC, %s%%)
New USDC amount: %s (%s%%)
New liquidity: %s`,
                    positionIdString,

                    // Prices
                    newPositionInfo.price.toFixed(4),
                    newPositionInfo.lowerPrice.toFixed(4), newPositionInfo.price.subtract(newPositionInfo.lowerPrice).divide(newPositionInfo.price).multiply(100).toFixed(2),
                    newPositionInfo.upperPrice.toFixed(4), newPositionInfo.upperPrice.subtract(newPositionInfo.price).divide(newPositionInfo.price).multiply(100).toFixed(2),

                    // Old stake values
                    oldTotalStakeValueUSDC.toFixed(2),
                    positionInfo.position.amount0.toFixed(), oldStakeAmountAPrice.toFixed(2), oldStakeAmountAPrice.div(oldTotalStakeValueUSDC).mul(100).toFixed(2),
                    positionInfo.position.amount1.toFixed(2), oldPositionAmount1AsDecimal.div(oldTotalStakeValueUSDC).mul(100).toFixed(2),
                    positionInfo.position.liquidity,

                    // New stake values
                    newTotalStakeValueUSDC.toFixed(2),
                    newPositionInfo.position.amount0.toFixed(), newStakeAmountAPrice.toFixed(2), newStakeAmountAPrice.div(newTotalStakeValueUSDC).mul(100).toFixed(2),
                    newPositionInfo.position.amount1.toFixed(2), newPositionAmount1AsDecimal.div(newTotalStakeValueUSDC).mul(100).toFixed(2),
                    newPositionInfo.liquidity
                );
            }
        }

        // Close the attempt amount
        if (dbPosition != null) {
            // Don't keep repeating this
            dbPosition.redepositAttemptsRemaining = 0;
            // Save it
            await dbPosition.save();
        }

        // Send a heartbeat
        if (textToSendViaTelegram != null)
            await alertViaTelegram(textToSendViaTelegram);
    }

    static async getAllPositionIds(): Promise<BigInt[]> {
        const numPositions = await nftTokenContract.balanceOf(userWallet.address);

        const positionTimes = times(Number(numPositions));

        const positionIds = await Bluebird.map(positionTimes, i => nftTokenContract
            .tokenOfOwnerByIndex(userWallet, i)
            .then(BigInt),
            { concurrency: MAX_CONCURRENCY });

        return positionIds;
    }

    static async getAllPositions(type: GetPositionsType = GetPositionsType.HasLiquidity): Promise<PositionInfo[]> {
        const positionIds = await this.getAllPositionIds();

        debug("positionIds=", positionIds);

        const positionInfosWithNulls = await Bluebird.map(positionIds, async (positionId): Promise<PositionInfo | null> => {
            /// Get the position
            const position = await nftTokenContract.positions(positionId);

            debug("position.liquidity=%s, rawPosition=", position.liquidity, position,);

            const liquidityString = position.liquidity.toString();

            // Really all means get it all
            if (type != GetPositionsType.ReallyAll) {
                debug( "We are looking for a specific position.");
                // Do we have liquidity
                const hasLiquidity = BigInt(liquidityString) > 0;
                const wantLiquidity = type == GetPositionsType.HasLiquidity;

                debug("position %s has liquidity=%s and we want liquidity=%s.", positionId, hasLiquidity, wantLiquidity);

                if (hasLiquidity != wantLiquidity) {
                    debug("Excluding position.");
                    return (null);
                }
            }

            const collectResults = await nftTokenContract.collect.staticCall(
                {
                    tokenId: positionId,
                    recipient: userWallet.address, // some tokens might fail if transferred to address(0)
                    amount0Max: this.MAX_UINT128,
                    amount1Max: this.MAX_UINT128,
                },
                { from: userWallet.address } // need to simulate the call as the owner
            );

            debug("collect results=", collectResults);

            // The fee
            const feeAmount = Number(position.fee);

            // Get the pool
            const poolAndPoolInfo = await PoolHelper.getWethUsdcPoolAndPoolinfo(feeAmount);

            const { pool } = poolAndPoolInfo;

            const tickLowerNumber = Number(position.tickLower);
            const tickUpperNumber = Number(position.tickUpper);

            const constructedPosition = new Position({
                pool,
                tickLower: tickLowerNumber,
                tickUpper: tickUpperNumber,
                liquidity: liquidityString
            });

            debug("constructedPosition=", constructedPosition);

            // Get the price
            const price = PriceHelper.sqrtRatioX96ToPrice(
                pool.token0,
                pool.token1,
                BigInt(pool.sqrtRatioX96.toString())
            );

            // Get the upper and lower price in USDC
            const lowerPrice = tickToPrice(pool.token0, pool.token1, tickLowerNumber);
            const upperPrice = tickToPrice(pool.token0, pool.token1, tickUpperNumber);

            debug("price=%s, numerator=%s, denominator=%s, priceDecimal=%s", price.toFixed(), price.numerator, price.denominator, price.toDecimal());

            const [tokensOwed0, tokensOwed1] = collectResults;

            debug("tokensOwed0=%s, tokensOwed1=%s", tokensOwed0, tokensOwed1);

            // Return it
            return ({
                lowerPrice,
                upperPrice,
                position: constructedPosition,
                price,
                poolAndPoolInfo,
                positionId,
                tickLower: Number(position.tickLower),
                tickUpper: Number(position.tickUpper),
                liquidity: BigInt(position.liquidity.toString()),
                feeGrowthInside0LastX128: BigInt(position.feeGrowthInside0LastX128.toString()),
                feeGrowthInside1LastX128: BigInt(position.feeGrowthInside1LastX128.toString()),
                tokensOwed0: DecimalUtil.fromBigNumberish(tokensOwed0, WETH_TOKEN.decimals),
                tokensOwed1: DecimalUtil.fromBigNumberish(tokensOwed1, USDC_TOKEN.decimals),
            } as PositionInfo);
        }, { concurrency: MAX_CONCURRENCY });

        return positionInfosWithNulls.filter(Boolean) as PositionInfo[];
    }
}