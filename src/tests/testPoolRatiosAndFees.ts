import Decimal from "decimal.js";
import { USDC_TOKEN, WANTED_FEE_AMOUNT, WETH_TOKEN } from "../constants";
import "../helpers/DecimalUtil";
import LiquidityCalc from "../helpers/LiquidityCalc";
import PoolHelper from "../helpers/PoolHelper";
import PositionManager from "../helpers/PositionManager";
import SwapHelper from "../helpers/SwapHelper";
import { CurrencyAmount } from "@uniswap/sdk-core";

(async function() {
    const positinPool = await PoolHelper.getWethUsdcPoolAndPoolinfo(WANTED_FEE_AMOUNT);
    const { pool, poolInfo } = positinPool;

    const { tickLower, tickUpper } = PositionManager.calculateTicks(poolInfo);

    const testy = await SwapHelper.getBestFeeTier(WETH_TOKEN, USDC_TOKEN, CurrencyAmount.fromRawAmount( WETH_TOKEN, "66174690186976559699" ) );

    console.log( "testy=", testy);

    let wethBalance = new Decimal(0).toCurrencyAmount(WETH_TOKEN);
    let usdcBalance = new Decimal(7000).toCurrencyAmount(USDC_TOKEN);

    let ratioHelper = await LiquidityCalc.getRatio(
        wethBalance,
        usdcBalance,
        tickUpper,
        tickLower,
        pool
    );

    console.log( "ratioHelper 1=", ratioHelper );


    wethBalance = new Decimal(1).toCurrencyAmount(WETH_TOKEN);
    usdcBalance = new Decimal(0).toCurrencyAmount(USDC_TOKEN);

    ratioHelper = await LiquidityCalc.getRatio(
        wethBalance,
        usdcBalance,
        tickUpper,
        tickLower,
        pool
    );

    console.log( "ratioHelper 2=", ratioHelper );

    process.exit( 0 );
})();
