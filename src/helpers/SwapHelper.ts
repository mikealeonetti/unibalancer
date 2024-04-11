import { Token } from "@uniswap/sdk-core";
import { FeeAmount } from "@uniswap/v3-sdk";
import Decimal from "decimal.js";
import Quoter from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json';
import { QUOTER_CONTRACT_ADDRESS } from "../constants";
import { provider } from "../network";
import { ethers } from "ethers";
import Bluebird from "bluebird";

import Debug from 'debug';

const debug = Debug("unibalancer:helpers:SwapHelper");

interface BestFeeTierReturn {
    feeAmount: FeeAmount;
    receiveEsimate: Decimal;
}

export default class SwapHelper {
    static SWAP_FEES = [FeeAmount.LOW, FeeAmount.MEDIUM, FeeAmount.HIGH];

    //static 



    static async getBestFeeTier(tokenA: Token, tokenB: Token, inputAmountA: Decimal): Promise<BestFeeTierReturn> {
        const quoterContract = new ethers.Contract(
            QUOTER_CONTRACT_ADDRESS,
            Quoter.abi,
            provider
        );

        debug("Getting best fee tier", tokenA, tokenB, inputAmountA);
        // Loop all fee amounts
        const allTiers = await Bluebird.map(this.SWAP_FEES, async (feeAmount: FeeAmount): Promise<BestFeeTierReturn> => {
            debug("About to quote", feeAmount);
            const number = await quoterContract.quoteExactInputSingle.staticCall(
                tokenA.address,
                tokenB.address,
                feeAmount,
                inputAmountA.toBigIntString(tokenA.decimals),
                0
            );

            debug( "number=%s, fee=%s", number, feeAmount );

            return ({
                feeAmount,
                receiveEsimate : new Decimal( String( number ) )
            });
        });

        // Get the best
        const best = allTiers.reduce( ( best : BestFeeTierReturn, current : BestFeeTierReturn) : BestFeeTierReturn => {
            if( current.receiveEsimate.gt( best.receiveEsimate ) )
                return( current );
            return( best );
        }, { feeAmount : FeeAmount.MEDIUM, receiveEsimate : new Decimal( 0 ) } as BestFeeTierReturn);

        return best;
    }
}