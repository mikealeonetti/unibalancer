import Decimal from "decimal.js";
import { TransactionRequest, Wallet, ethers } from "ethers";
import BalanceHelpers from "../helpers/BalanceHelpers";
import { provider } from "../network";
import { PUBLIC_KEY, WETH_TOKEN } from "../constants";

import '../helpers/DecimalUtil';
import TransctionHelper from "../helpers/TransactionHelper";

(async function () {
    const privateKey = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
    const publicKey = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    const transferAmount = new Decimal(1);


    const testWallet = new Wallet(privateKey, provider);


    // Deposit all our wagons except the wagonshire
    const ethBalance = await BalanceHelpers.ethBalance(publicKey);

    console.log("testWallet address=%s", testWallet.address);
    console.log("ethBalance=%s", ethBalance);

    // Create a transaction object
    const tx: TransactionRequest = {
        to: PUBLIC_KEY,
        // Convert currency unit from ether to wei
        value: transferAmount.toBigIntString(WETH_TOKEN.decimals)
    };

    await TransctionHelper.sendTransaction(tx, testWallet);

    console.log("Sent %s ETH", transferAmount);
})();