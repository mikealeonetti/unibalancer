
import { Token } from '@uniswap/sdk-core';
import { toUpper } from 'lodash';
import minimist from 'minimist';
import { USDC_TOKEN, WETH_TOKEN } from '../constants';
import Decimal from 'decimal.js';
import BalanceHelpers from '../helpers/BalanceHelpers';
import Erc20Contract from '../contracts/Erc20Contract';
import { userWallet } from '../network';
import { DBProperty } from '../database';
import TransactionHelper from '../helpers/TransactionHelper';


const argv = minimist(process.argv.slice(2));

function printUsageAndExit() {
    console.error(`Usage ${process.argv[0]} ${process.argv[1]} [token] [address] [amount]`);
    process.exit(1);
}

(async function () {
    // Get the person to transfer it to
    let [tokenSymbolToTransfer, addressToTransferTo, amountToTransfer] = argv._;

    if (!tokenSymbolToTransfer)
        printUsageAndExit();
    if (!addressToTransferTo)
        printUsageAndExit();
    if (!amountToTransfer)
        printUsageAndExit();

    // Get the token we want
    tokenSymbolToTransfer = toUpper(tokenSymbolToTransfer);
    let tokenToTransfer: Token;


    if (tokenSymbolToTransfer == "WETH") {
        tokenToTransfer = WETH_TOKEN;
    }
    else if (tokenSymbolToTransfer == "USDC") {
        tokenToTransfer = USDC_TOKEN;
    }
    else {
        console.error("Unknown token [%s].", tokenSymbolToTransfer);
        process.exit(1);
    }

    // Test the amount
    const amountAsDecimal = new Decimal(amountToTransfer);

    // Get the contract
    const erc20Contract = Erc20Contract.fromToken(tokenToTransfer, userWallet);

    // Get the balance or the holdings
    const [
        currentBalance,
        holdingsBalance
    ] = await Promise.all([
        erc20Contract.balanceOf(userWallet.address),
        DBProperty.getTokenHoldings(tokenSymbolToTransfer)
    ]);

    console.log("currentBalance=%s, holdingsBalance=%s", currentBalance, holdingsBalance);

    // Do we have enough?
    if( currentBalance.lt(holdingsBalance) ) {
        console.error( "Our holdings is %s but we only have %s. Fatal error.", holdingsBalance.toFixed(), currentBalance.toFixed());
        process.exit(1);
    }

    // Are we asking too much?
    if( amountAsDecimal.gt(holdingsBalance) ) {
        console.error("You want to transfer %s but there is only %s in holdings to transfer.", amountAsDecimal.toFixed(), holdingsBalance.toFixed());
        process.exit(1);
    }

    // Do the transfer
    const clientTransactionResponse = await erc20Contract.transfer(addressToTransferTo, amountAsDecimal);

    // Add as an expense the gas
    await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, `gas for user transfer ${amountAsDecimal.toFixed()} of ${tokenSymbolToTransfer}.`);

    // Save as minus
    await DBProperty.subtractTokenHoldings(tokenSymbolToTransfer, amountAsDecimal);

    console.log( "Transfer is complete. Hash=%s.", clientTransactionResponse.receipt.hash);
})();