import { FeeAmount, Pool, computePoolAddress } from "@uniswap/v3-sdk"
import { POOL_FACTORY_CONTRACT_ADDRESS, USDC_TOKEN, WETH_TOKEN } from "../constants"
import { Token } from "@uniswap/sdk-core"
import { Contract } from "ethers";
import IUniswapV3PoolABI from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json';
import { userWallet } from "../network";

import Debug from 'debug';

const debug = Debug("unibalancer:helpers:PoolHelper");

export interface PoolInfo {
    token0: string;
    token1: string;
    fee: number;
    tickSpacing: number;
    sqrtPriceX96: BigInt;
    liquidity: BigInt;
    tick: number;
};

export interface PoolAndPoolInfo {
    pool: Pool;
    poolInfo: PoolInfo;
}

export default class PoolHelper {
    static wethUsdcPool = PoolHelper.getPoolContract(WETH_TOKEN, USDC_TOKEN, FeeAmount.MEDIUM);

    static async getWethUsdcPoolInfo(): Promise<PoolInfo> {
        return this.getPoolInfo(this.wethUsdcPool);
    }

    static getPoolContract(tokenA: Token, tokenB: Token, fee: FeeAmount): Contract {
        const currentPoolAddress = computePoolAddress({
            factoryAddress: POOL_FACTORY_CONTRACT_ADDRESS,
            tokenA,
            tokenB,
            fee,
        });

        const poolContract = new Contract(
            currentPoolAddress,
            IUniswapV3PoolABI.abi,
            userWallet
        )

        return poolContract;
    }

    static async getWethUsdcPoolAndPoolinfo(): Promise<PoolAndPoolInfo> {
        // get pool info
        const poolInfo = await PoolHelper.getWethUsdcPoolInfo();

        debug("constructPosition poolInfo=", poolInfo);

        // construct pool instance
        const pool = new Pool(
            WETH_TOKEN,
            USDC_TOKEN,
            poolInfo.fee,
            poolInfo.sqrtPriceX96.toString(),
            poolInfo.liquidity.toString(),
            poolInfo.tick
        );

        return ({ pool, poolInfo });
    }


    static async getPoolInfo(poolContract: Contract): Promise<PoolInfo> {
        const [token0, token1, fee, tickSpacing, liquidity, slot0] =
            await Promise.all([
                poolContract.token0(),
                poolContract.token1(),
                poolContract.fee(),
                poolContract.tickSpacing(),
                poolContract.liquidity(),
                poolContract.slot0(),
            ])

        return {
            token0: String(token0),
            token1: String(token1),
            fee: Number(fee),
            tickSpacing: Number(tickSpacing),
            liquidity: BigInt(liquidity),
            sqrtPriceX96: BigInt(slot0[0]),
            tick: Number(slot0[1]),
        }
    }
}