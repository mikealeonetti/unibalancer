import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";
import Decimal from "decimal.js";
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { IS_PRODUCTION, QUOTER_CONTRACT_ADDRESS } from "../constants";
import { provider } from "../network";
import { ethers } from "ethers";
import Bluebird from "bluebird";

import Debug from 'debug';
import { CurrencyAmount } from "@uniswap/sdk-core/dist/entities";
import logger from "../logger";

const debug = Debug("unibalancer:helpers:SwapHelper");

interface BestFeeTierReturn {
    feeAmount: FeeAmount;
    receiveEsimate: Decimal;
}

export default class SwapHelper {
    static SWAP_FEES = [FeeAmount.LOWEST, FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];

    static async getBestFeeTier(tokenA: Token, tokenB: Token, inputAmountA: CurrencyAmount<Token>): Promise<BestFeeTierReturn> {
        const quoterContract = new ethers.Contract(
            QUOTER_CONTRACT_ADDRESS,
            Quoter.abi,
            provider
        );

        debug("Getting best fee tier", tokenA, tokenB, inputAmountA.quotient.toString());
        // Loop all fee amounts
        const allTiers = await Bluebird.map(this.SWAP_FEES, async (feeAmount: FeeAmount): Promise<BestFeeTierReturn | null> => {
            try {
                let numberPromise = quoterContract.quoteExactInputSingle.staticCall(
                    tokenA.address,
                    tokenB.address,
                    feeAmount,
                    inputAmountA.quotient.toString(),
                    0
                );

                // In debug wrap
                if (!IS_PRODUCTION) {
                    numberPromise = Bluebird.resolve(numberPromise).timeout(1000);
                }

                debug("About to quote", feeAmount);
                const number = await numberPromise;

                debug("number=%s, fee=%s", number, feeAmount);

                return ({
                    feeAmount,
                    receiveEsimate: new Decimal(String(number))
                });
            }
            catch (e) {
                logger.warn("Error getting FeeAmount %s", feeAmount, e);
            }

            return null;
        }); //, {concurrency : 5});

        // Get only the valid tiers
        const validTiers = allTiers.filter(Boolean) as BestFeeTierReturn[];

        // Get the best
        const best = validTiers.reduce((best: BestFeeTierReturn, current: BestFeeTierReturn): BestFeeTierReturn => {
            if (current.receiveEsimate.gt(best.receiveEsimate))
                return (current);
            return (best);
        }, { feeAmount: FeeAmount.MEDIUM, receiveEsimate: new Decimal(0) } as BestFeeTierReturn);

        return best;
    }
}