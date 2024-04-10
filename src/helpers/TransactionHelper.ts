import { TransactionReceipt, TransactionRequest, TransactionResponse, Wallet } from "ethers";
import { provider, userWallet } from "../network";
import { ClientTransactionResponse } from "../types";

import Debug from 'debug';
import { WETH_TOKEN } from "../constants";
import { DBProperty } from "../database";
import DecimalUtil from "./DecimalUtil";
const debug = Debug("unibalancer:helpers:TransactionHelpers");

export default class TransctionHelper {
    static async addDeficitFromTransaction(clientTransactionResponse : ClientTransactionResponse, reason : string ) : Promise<void> {
        const { gasUsed } = clientTransactionResponse.receipt;

        // Add the eth used
        const ethUsed = DecimalUtil.fromBigNumberish( gasUsed, WETH_TOKEN.decimals );

        debug( "gasUsed=%s, eth used=%s", gasUsed, ethUsed );

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