import Decimal from "decimal.js"
import { WETH_TOKEN } from "../constants"
import DecimalUtil from "../helpers/DecimalUtil"
import TransactionHelper from "../helpers/TransactionHelper"

import { Wallet } from "ethers"
import Weth9Abi from '../abis/weth9.json'
import { userWallet } from '../network'
import { ClientTransactionResponse } from "../types"
import Erc20Contract from "./Erc20Contract"

export default class WethContract extends Erc20Contract {
  constructor(wallet: Wallet) {
    super(WETH_TOKEN.address, WETH_TOKEN.decimals, Weth9Abi, wallet);
  }

  // wraps ETH (rounding up to the nearest ETH for decimal places)
  async wrapEth(ethAmount: Decimal): Promise<ClientTransactionResponse> {

    const transaction = {
      data: this.contract.interface.encodeFunctionData('deposit'),
      value: ethAmount.toBigIntString(this.decimals),
      from: this.wallet.address,
      to: WETH_TOKEN.address
    }

    return TransactionHelper.sendTransaction(transaction, this.wallet);
  }

  // unwraps ETH (rounding up to the nearest ETH for decimal places)
  async unwrapEth(wethAmount: Decimal): Promise<ClientTransactionResponse> {
    const transaction = {
      data: this.contract.interface.encodeFunctionData('withdraw', [
        DecimalUtil.toBigIntString(wethAmount, this.decimals)
      ]),
      from: this.wallet.address,
      to: WETH_TOKEN.address,
    }

    return TransactionHelper.sendTransaction(transaction, this.wallet);
  }
}

// Export a singleton
export const wethContract = new WethContract(userWallet);