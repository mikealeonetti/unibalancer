import { CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { FeeAmount, Pool, Route, SwapOptions, SwapQuoter, SwapRouter, Trade, computePoolAddress } from "@uniswap/v3-sdk";
import { POOL_FACTORY_CONTRACT_ADDRESS, QUOTER_CONTRACT_ADDRESS, SWAP_ROUTER_ADDRESS, SWAP_SLIPPAGE } from "./constants";

import Debug from 'debug';
import Decimal from "decimal.js";
import { ethers } from "ethers";
import JSBI from "jsbi";
import Erc20Contract from "./contracts/Erc20Contract";
import { DBProperty } from "./database";
import SwapHelper from "./helpers/SwapHelper";
import { getSymbolFromTokenAddress } from "./helpers/TokenHelper";
import TransactionHelper from "./helpers/TransactionHelper";
import { userWallet } from "./network";
import { ClientTransactionResponse } from "./types";

const debug = Debug("unibalancer:swapToken");

export default async function (tokenA: Token, tokenB: Token, inputAmountA: Decimal, feeAmount : FeeAmount): Promise<ClientTransactionResponse> {
    // Get the shorthand names
    const tokenASymbol = getSymbolFromTokenAddress(tokenA.address);
    const tokenBSymbol = getSymbolFromTokenAddress(tokenB.address);

    // How much it'll cost us to swap
    const totalSwapFee = inputAmountA.times(feeAmount).div(1e6);

    debug("swapFee=%s", totalSwapFee);

    // Get the pool to swapalicious
    const poolAddress = computePoolAddress({
        factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
        tokenA,
        tokenB,
        fee: feeAmount
    });

    debug("poolAddress=", poolAddress);

    const poolContract = new ethers.Contract(
        poolAddress,
        IUniswapV3PoolABI.abi,
        userWallet
    );

    debug("poolContract=", poolContract);

    const quoterContract = new ethers.Contract(
        QUOTER_CONTRACT_ADDRESS,
        Quoter.abi,
        userWallet
    );

    debug("quoterContract=", quoterContract);

    // Check the allowance
    const tokenAContract = Erc20Contract.fromToken(tokenA, userWallet);

    // Get the allowance
    const currentTokenAAllowance = await tokenAContract.allowanceOf(userWallet.address, SWAP_ROUTER_ADDRESS);

    // Do we have enough?
    if (!currentTokenAAllowance.gte(inputAmountA)) {
        debug("Need to approve unlimited.");
        const clientTransactionResponse = await tokenAContract.approve(SWAP_ROUTER_ADDRESS);

        await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, `approve ${tokenASymbol} to swap.`);
    }

    // Get the pool info
    const [token0, token1, fee, liquidity, slot0] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.fee(),
        poolContract.liquidity(),
        poolContract.slot0(),
    ])

    debug("token0=", token0);
    debug("token1=", token1);
    debug("fee=", fee);
    debug("liquidity=", liquidity);

    /*
    const quotedAmountOut = await quoterContract.quoteExactInputSingle(
        token0,
        token1,
        fee,
        ethers.parseUnits(
            "1",
            WETH_TOKEN.decimals
        ).toString(),
        0
    );


    debug("quotedAmountOut=", quotedAmountOut);
    */

    debug("slot0=", slot0);

    const sqrtPriceX96 = JSBI.BigInt(String(slot0[0]));
    const tick = Number(slot0[1]);

    debug("sqrtPriceX96=", sqrtPriceX96, "typeof sqrtPriceX96=", typeof sqrtPriceX96);
    debug("tick=", tick);

    const pool = new Pool(
        tokenA,
        tokenB,
        feeAmount,
        sqrtPriceX96.toString(),
        liquidity.toString(),
        tick
    );

    debug("pool=", pool);

    const swapRoute = new Route(
        [pool],
        tokenA,
        tokenB
    );

    debug("swapRoute=", swapRoute);

    const inputAmountACurrency = inputAmountA.toCurrencyAmount(tokenA); //DecimalUtil.toCurrencyAmount(tokenA, inputAmountA);

    const { calldata } = SwapQuoter.quoteCallParameters(
        swapRoute,
        inputAmountACurrency,
        TradeType.EXACT_INPUT,
        {
            // This caused it not to work
            //useQuoterV2: true,
        }
    );

    debug("calldata=", calldata);

    const quoteCallReturnData = await userWallet.call({
        to: QUOTER_CONTRACT_ADDRESS,
        data: calldata,
    });

    debug("quoteCallReturnData=", quoteCallReturnData);

    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256'], quoteCallReturnData)

    debug("decoded=", decoded);

    // Make the output amount
    const decodedCurrencyAmount = CurrencyAmount.fromRawAmount(
        tokenB,
        JSBI.BigInt(decoded).toString()
    );

    const uncheckedTrade = Trade.createUncheckedTrade({
        route: swapRoute,
        inputAmount: inputAmountACurrency,
        outputAmount: decodedCurrencyAmount,
        tradeType: TradeType.EXACT_INPUT,
    });

    // Tradey
    debug("uncheckedTrade=", uncheckedTrade);

    // Get the tolerance
    const slippageTolerance = new Decimal( SWAP_SLIPPAGE ).div( 100 ).toPercent();

    debug( "slippageTolerance=%s", slippageTolerance.quotient );

    const options: SwapOptions = {
        slippageTolerance, //slippageTolerance: new Percent(50, 10_000), // 50 bips, or 0.50%
        deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
        recipient: userWallet.address,
    };

    debug("SwapOptions=", options);

    const methodParameters = SwapRouter.swapCallParameters([uncheckedTrade], options)

    const tx = {
        data: methodParameters.calldata,
        to: SWAP_ROUTER_ADDRESS,
        value: methodParameters.value,
        from: userWallet.address,
        //maxFeePerGas: MAX_FEE_PER_GAS,
        //maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
    }

    const clientTransactionResponse = await TransactionHelper.sendTransaction(tx);

    // Add the definite calcs
    await Promise.all([
        DBProperty.addDeficits(tokenASymbol, totalSwapFee, `fee on swap ${inputAmountA} of ${tokenASymbol} to ${tokenBSymbol}.`),
        TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, `gas on swap ${inputAmountA} of ${tokenASymbol} to ${tokenBSymbol}.`)
    ]);

    return (clientTransactionResponse);
}