import { TransactionReceipt, TransactionRequest, TransactionResponse, Wallet } from "ethers";
import { provider, userWallet } from "../network";
import { ClientTransactionResponse } from "../types";

import Debug from 'debug';
import Decimal from "decimal.js";
import { WETH_TOKEN } from "../constants";
import { DBProperty } from "../database";
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

    static async resolveTransactionResponse(response: TransactionResponse): Promise<ClientTransactionResponse> {
        let receipt: TransactionReceipt | null = null;

        while (receipt === null) {
            try {
                receipt = await provider.getTransactionReceipt(response.hash)

                debug("resolveTransactionResponse receipt=", receipt);

                if (receipt === null) {
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

    static async sendTransaction(transaction: TransactionRequest, wallet : Wallet = userWallet): Promise<ClientTransactionResponse> {
        const response = await wallet.sendTransaction(transaction)

        debug("sendTransaction response=", response);

        return this.resolveTransactionResponse(response);
    }
}