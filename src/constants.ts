import { Token } from '@uniswap/sdk-core';
import 'dotenv/config';
import { toLower } from 'lodash';

export const IS_PRODUCTION = toLower(process.env.IS_PRODUCTION) == "true";

export const NETWORK_PROVIDER = (IS_PRODUCTION ? process.env.PRODUCTION_NETWORK_PROVIDER : process.env.DEBUG_NETWORK_PROVIDER) as string;

export const NETWORK_CHAIN_ID = Number(IS_PRODUCTION ? process.env.PRODUCTION_NETWORK_CHAINID : process.env.DEBUG_NETWORK_CHAINID);

export const PRIVATE_KEY = process.env.PRIVATE_KEY as string;
export const PUBLIC_KEY = process.env.PUBLIC_KEY as string;

export const WETH_TOKEN = new Token(
  1,
  '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  18,
  'WETH',
  'Wrapped Ether'
);

export const USDC_TOKEN = new Token(
  1,
  '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  6,
  'USDC',
  'USD//C'
);

export const QUOTER_CONTRACT_ADDRESS = "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
export const SWAP_ROUTER_ADDRESS = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
export const NONFUNGIBLE_POSITION_MANAGER_CONTRACT_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';
export const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45';
export const POOL_FACTORY_CONTRACT_ADDRESS = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

///

export const DEPOSIT_SLIPPAGE = Number(process.env.DEPOSIT_SLIPPAGE) || 3;
export const SWAP_SLIPPAGE = Number(process.env.SWAP_SLIPPAGE) || 1;
export const WITHDRAW_SLIPPAGE = Number(process.env.WITHDRAW_SLIPPAGE) || 3;

export const LOG_LEVEL: string = process.env.LOG_LEVEL || "info";

export const TOLERANCE_IN_MINUTES: number = Number(process.env.TOLERANCE_IN_MINUTES) || 5;

export const WANTED_TICK_SPACING = IS_PRODUCTION ? (Number(process.env.WANTED_TICK_SPACING) || 4) : 64;

export const RANGE_PERCENT = Number(process.env.RANGE_PERCENT) || 10;

export const TAKE_PROFIT_PERCENT = Number(process.env.TAKE_PROFIT_PERCENT) || 50;

export const MAXIMUM_GAS_TO_SAVE = Number(process.env.MAXIMUM_GAS_TO_SAVE) || 0.01;
export const MINIMUM_GAS_TO_SAVE = Number(process.env.MINIMUM_GAS_TO_SAVE) || 0.005;

export const MINIMUM_AMOUNT_TO_DEPOSIT_DOLLARS = Number(process.env.MINIMUM_AMOUNT_TO_DEPOSIT_DOLLARS) || 5;

export const REBALANCE_PER_HOUR_COUNT: number = Number(process.env.REBALANCE_PER_HOUR_COUNT) || 0
export const REBALANCE_AT_PERCENT: number = Number(process.env.REBALANCE_AT_PERCENT) || 1

export const IS_DEBUG_MODE: Boolean = process.env.IS_DEBUG_MODE != null && toLower(process.env.IS_DEBUG_MODE) == "true" || false;

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const HEARTBEAT_FREQUENCY_MINUTES = Number(process.env.HEARTBEAT_FREQUENCY_MINUTES) || 60;

export const MAX_RETRIES_SETTING = 5;

export const MAX_CONCURRENCY : number = 5;