import { TransactionReceipt, TransactionRequest, TransactionResponse, Wallet } from "ethers";
import { provider, userWallet } from "../network";
import { ClientTransactionResponse } from "../types";

import Debug from 'debug';
import Decimal from "decimal.js";
import { WETH_TOKEN } from "../constants";
import { DBProperty } from "../database";
import Bluebird from "bluebird";
import logger from "../logger";
const debug = Debug("unibalancer:helpers:TransactionHelpers");

export default class TransctionHelper {
    static async addDeficitFromTransaction(clientTransactionResponse : ClientTransactionResponse, reason : string ) : Promise<void> {
        const { gasUsed, gasPrice } = clientTransactionResponse.receipt;

        // Add the eth used
        const ethUsed = new Decimal( gasUsed.toString() ).times( gasPrice.toString() ).adjustDecimalsLeft( WETH_TOKEN.decimals );

        //DecimalUtil.fromBigNumberish( gasUsed, WETH_TOKEN.decimals );

        debug( "gasUsed=%s, gasPrice=%s, eth used=%s", gasUsed, gasPrice, ethUsed );

        // Add the deficit
        await DBProperty.addDeficits("weth", ethUsed, reason);
    }

    private static async resolveTransactionResponsePrivate(response: TransactionResponse): Promise<ClientTransactionResponse> {
        let receipt: TransactionReceipt | null = null;

        while (receipt === null) {
            try {
                receipt = await provider.getTransactionReceipt(response.hash)

                debug("resolveTransactionResponse receipt=", receipt);

                if (receipt === null) {
                    await Bluebird.delay(10);
                    continue
                }

                // Return it
                return ({ response, receipt });
            } catch (e) {
                debug(`resolveTransactionResponse error:`, e)
                throw e;
            }
        }

        throw new Error("Could not get transaction receipt.");
    }

    static resolveTransactionResponse = (response: TransactionResponse) : Promise<ClientTransactionResponse>=>
        // Try and resolve it
        Bluebird.resolve( this.resolveTransactionResponsePrivate(response) )
        // Within the time alloted
        .timeout(5*60*1000)
        // Or exit the program
        .catch( e=>{
            logger.error("resolveTransactionResponse fatal error", e);
            process.exit(1);
        });

    static async sendTransaction(transaction: TransactionRequest, wallet : Wallet = userWallet): Promise<ClientTransactionResponse> {
        const response = await wallet.sendTransaction(transaction)

        debug("sendTransaction response=", response);

        return this.resolveTransactionResponse(response);
    }
}