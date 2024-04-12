import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { FeeAmount } from "@uniswap/v3-sdk";
import Decimal from "decimal.js";
import { QUOTER_CONTRACT_ADDRESS, USDC_TOKEN, WETH_TOKEN } from "../constants";
import "../helpers/DecimalUtil";
import PoolHelper from "../helpers/PoolHelper";
import { ethers } from 'ethers';
import { provider, userWallet } from '../network';
import PriceHelper from '../helpers/PriceHelper';
import SwapHelper from '../helpers/SwapHelper';
import { CurrencyAmount } from '@uniswap/sdk-core';

(async function() {
    const poolContractLow = PoolHelper.getPoolContract(WETH_TOKEN, USDC_TOKEN, FeeAmount.LOW);
    const poolContractMedium = PoolHelper.getPoolContract(WETH_TOKEN, USDC_TOKEN, FeeAmount.MEDIUM);

    // Get the pools
    const poolInfoLow = await PoolHelper.getPoolInfo(poolContractLow);
    const poolInfoMedium = await PoolHelper.getPoolInfo(poolContractMedium);

    console.log( "poolInfoLow=", poolInfoLow );
    console.log( "poolInfoMedium=", poolInfoMedium );

    const priceLow = PriceHelper.sqrtRatioX96ToPrice(WETH_TOKEN, USDC_TOKEN, BigInt( poolInfoLow.sqrtPriceX96.toString()));
    const priceMedium = PriceHelper.sqrtRatioX96ToPrice(WETH_TOKEN, USDC_TOKEN, BigInt( poolInfoMedium.sqrtPriceX96.toString()));

    console.log( "priceLow=%s", priceLow.toFixed() );
    console.log( "priceMedium=%s", priceMedium.toFixed() );

    const quoterContract = new ethers.Contract(
        QUOTER_CONTRACT_ADDRESS,
        Quoter.abi,
        provider
      );

    const tradeAmount = new Decimal(1).toBigIntString(WETH_TOKEN.decimals);

    /*
    const quoteLow = await quoterContract.quoteExactInputSingle.staticCall(
        WETH_TOKEN.address,
        USDC_TOKEN.address,
        FeeAmount.LOW,
        tradeAmount,
        0
      );

      console.log( "quoteLow=", quoteLow );

      const quoteMedium = await quoterContract.quoteExactInputSingle.staticCall(
        WETH_TOKEN.address,
        USDC_TOKEN.address,
        FeeAmount.MEDIUM,
        tradeAmount,
        0
      );

      console.log( "quoteMedium=", quoteMedium );
      */

      const quoteMedium = await quoterContract.quoteExactInputSingle.staticCall(
        WETH_TOKEN.address,
        USDC_TOKEN.address,
        FeeAmount.MEDIUM,
        tradeAmount,
        0
      );

      const bestTierWeth = await SwapHelper.getBestFeeTier(WETH_TOKEN, USDC_TOKEN, CurrencyAmount.fromRawAmount(WETH_TOKEN, "1") );
      const bestTierUsdc = await SwapHelper.getBestFeeTier(USDC_TOKEN, WETH_TOKEN, CurrencyAmount.fromRawAmount(USDC_TOKEN, "3000"));

      console.log("bestTierWeth=", bestTierWeth );
      console.log("bestTierUsdc=", bestTierUsdc );

    process.exit( 0 );
})();
