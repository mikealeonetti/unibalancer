
import { CurrencyAmount, Token, TradeType } from "@uniswap/sdk-core";
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { FeeAmount, Pool, Route, SwapOptions, SwapQuoter, SwapRouter, Trade, computePoolAddress } from "@uniswap/v3-sdk";
import Debug from 'debug';
import Decimal from "decimal.js";
import { Wallet, ethers } from "ethers";
import JSBI from "jsbi";
import { POOL_FACTORY_CONTRACT_ADDRESS, QUOTER_CONTRACT_ADDRESS, SWAP_ROUTER_ADDRESS, SWAP_SLIPPAGE, USDC_TOKEN, WETH_TOKEN } from "../constants";
import Erc20Contract from "../contracts/Erc20Contract";
import WethContract from "../contracts/WethContract";
import TransactionHelper from "../helpers/TransactionHelper";
import { provider } from "../network";
import { ClientTransactionResponse } from "../types";
import BalanceHelpers from "../helpers/BalanceHelpers";
import Bluebird from "bluebird";

const debug = Debug("unibalancer:tests:doBunchOfSwaps");

async function privateSwap(tokenA: Token, tokenB: Token, inputAmountA: Decimal, wallet: Wallet): Promise<ClientTransactionResponse> {
    const feeAmount = FeeAmount.MEDIUM;

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
        wallet
    );

    debug("poolContract=", poolContract);

    const quoterContract = new ethers.Contract(
        QUOTER_CONTRACT_ADDRESS,
        Quoter.abi,
        wallet
    );

    debug("quoterContract=", quoterContract);

    // Check the allowance
    const tokenAContract = Erc20Contract.fromToken(tokenA, wallet);

    // Get the allowance
    const currentTokenAAllowance = await tokenAContract.allowanceOf(wallet.address, SWAP_ROUTER_ADDRESS);

    // Do we have enough?
    if (!currentTokenAAllowance.gte(inputAmountA)) {
        debug("Need to approve unlimited.");
        const clientTransactionResponse = await tokenAContract.approve(SWAP_ROUTER_ADDRESS);
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

    const quoteCallReturnData = await wallet.call({
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
    const slippageTolerance = new Decimal(SWAP_SLIPPAGE).div(100).toPercent();

    debug("slippageTolerance=%s", slippageTolerance.quotient);

    const options: SwapOptions = {
        slippageTolerance,
        deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes from the current Unix time
        recipient: wallet.address,
    };

    debug("SwapOptions=", options);

    const methodParameters = SwapRouter.swapCallParameters([uncheckedTrade], options)

    const tx = {
        data: methodParameters.calldata,
        to: SWAP_ROUTER_ADDRESS,
        value: methodParameters.value,
        from: wallet.address,
        //maxFeePerGas: MAX_FEE_PER_GAS,
        //maxPriorityFeePerGas: MAX_PRIORITY_FEE_PER_GAS,
    }

    const clientTransactionResponse = await TransactionHelper.sendTransaction(tx, wallet);

    return (clientTransactionResponse);
}

(async function () {
    const privateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    const publicKey = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const saveForGas = new Decimal( 0.1 );
    const swapCounts = 100;
    const delayMillis = 100;

    const testWallet = new Wallet(privateKey, provider);

    const testUsdcContract = Erc20Contract.fromToken(USDC_TOKEN, testWallet);
    const testWethContract = new WethContract(testWallet);

    // Deposit all our wagons except the wagonshire
    const ethBalance = await BalanceHelpers.ethBalance(publicKey);
    const wethDepositBalance = ethBalance.minus(saveForGas);

    console.log( "testWallet address=%s", testWallet.address);
    console.log( "ethBalance=%s", ethBalance);

    if( wethDepositBalance.gt(0) ) {
        console.log( "Want to deposit %s eth", wethDepositBalance);

        const wrapResponse = await testWethContract.wrapEth(wethDepositBalance);

        console.log( "Deposited %s eth", wethDepositBalance, wrapResponse);
    }

    // Now swap until dop
    for( let i=0; i<swapCounts; ++i ) {
        // Balances
        const [
            wethBalance,
            usdcBalance
        ] = await Promise.all( [
            testWethContract.balanceOf(publicKey),
            testUsdcContract.balanceOf(publicKey),
        ] );

        if( wethBalance.eq(0) && usdcBalance.eq(0) )
            throw new Error( "weth and usdc balance are both 0.");

        // Swap from, to
        const [ tokenA, tokenB, amountToSwap ] = wethBalance.gt(usdcBalance) ?
            // Weth to usdc
            [ WETH_TOKEN, USDC_TOKEN, wethBalance] :
            // Usdc to weth
            [ USDC_TOKEN, WETH_TOKEN, usdcBalance ];
        
        console.log( "Pass %d: Swapping %s of %s to %s...", i, tokenA.symbol, amountToSwap, tokenB.symbol );

        // Swappy
        await privateSwap(tokenA, tokenB, amountToSwap, testWallet);

        console.log( "`Pass %d: `Swapped.", i);

        // Wait
        await Bluebird.delay(delayMillis);
    }
})();