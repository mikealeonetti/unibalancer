import { TransactionReceipt, TransactionResponse } from "ethers";

/**
* SEND Transactions return this object on success.
*/
export type ClientTransactionResponse = {
    response: TransactionResponse;
    receipt: TransactionReceipt;
};