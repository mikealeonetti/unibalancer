
import { addHours } from 'date-fns';
import Debug from 'debug';
import { SAVE_BALANCE_EVERY_HOURS, USDC_TOKEN, WANTED_FEE_AMOUNT, WETH_TOKEN } from './constants';
import { DBProperty } from './database';
import PoolHelper from './helpers/PoolHelper';
import { PositionInfo } from "./helpers/PositionManager";
import PriceHelper from './helpers/PriceHelper';
import BalanceHelpers from './helpers/BalanceHelpers';
import { DBBalance } from './database/models/DBBalance';

const debug = Debug("unibalancer:shouldSaveBalance");

const LAST_SAVE_BALANCE_KEY = "LastTimeBalanceSaved";

export default async function (positionInfos: PositionInfo[]) {
    // Right NOW!
    const now = new Date();

    // Get the last heartbeat time
    const lastBalanceSaved = await DBProperty.getByKey(LAST_SAVE_BALANCE_KEY);

    debug("lastBalanceSaved=%s", lastBalanceSaved?.value);

    // Is it time?
    if (lastBalanceSaved != null && addHours(new Date(lastBalanceSaved.value), SAVE_BALANCE_EVERY_HOURS) > now) {
        debug("Not time save the balance.");
        return;
    }

    // Get the price from the pewl we are using
    const poolInfo = await PoolHelper.getWethUsdcPoolInfo(WANTED_FEE_AMOUNT);
    const price = PriceHelper.sqrtRatioX96ToPrice(WETH_TOKEN, USDC_TOKEN,  poolInfo.sqrtPriceX96);

    // Get the balances
    let [
        wethBalance,
        usdcBalance
    ] = await BalanceHelpers.adjustedWethUsdcBalanceAsCurrencyAmount();

    debug( "balances before wethBalance=%s, usdcbalance=%s", wethBalance, usdcBalance);

    // Now loop and add them togetta
    for( const { position } of positionInfos) {
        // Add the balance in the stake
        wethBalance = wethBalance.add(position.amount0);
        usdcBalance = usdcBalance.add(position.amount1);
    }

    // Calcualte the total usdc value
    const totalValueUsdc = wethBalance.toDecimal().times( price.toDecimal() ).plus( usdcBalance.toDecimal() );

    debug( "balances before wethBalance=%s, usdcbalance=%s, totalValueUsdc=%s", wethBalance, usdcBalance, totalValueUsdc);

    // Save them all
    await DBBalance.create({
        tokenA : wethBalance.toFixed(),
        tokenB : usdcBalance.toFixed(),
        totalUsdc : totalValueUsdc.toFixed(),
        price : price.toFixed()
    });

    // Last balance saved
    // Set the last heartbeat time
    await DBProperty.upsert({
        key: LAST_SAVE_BALANCE_KEY,
        value: now.toISOString()
    });
}