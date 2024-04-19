import { WANTED_FEE_AMOUNT } from "../constants";
import PoolHelper from "../helpers/PoolHelper";

(function (){
    const pool = PoolHelper.getWethUsdcPool(WANTED_FEE_AMOUNT);

    pool.on( "Swap", function( sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick) {
        console.log( "---- Swap tick=%s", tick);
    });

    console.log("Subscribed");
})();