import { FeeAmount } from "@uniswap/v3-sdk";
import PoolHelper from "../helpers/PoolHelper";

(function (){
    const pool = PoolHelper.getWethUsdcPool(FeeAmount.MEDIUM);

    pool.on( "Swap", function( sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick) {
        console.log( "---- Swap tick=%s", tick);
    });

    console.log("Subscribed");
})();