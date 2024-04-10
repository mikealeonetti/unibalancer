import Decimal from "decimal.js";
import { Addressable, Contract, MaxUint256, TransactionResponse, Wallet, ethers } from "ethers";
import ERC20ABI from '../abis/erc20.json';
import DecimalUtil from '../helpers/DecimalUtil';
import TransactionHelper from '../helpers/TransactionHelper';
import { ClientTransactionResponse } from "../types";

import { Token } from "@uniswap/sdk-core";
import Debug from 'debug';

const debug = Debug("unibalancer:constracts:erc20Contract");

export type AddressableOrString = string | Addressable;

export default class Erc20Contract {
    public readonly contract: Contract;
    public readonly decimals: number;
    protected readonly wallet : Wallet;

    constructor(address: AddressableOrString, decimals: number = 18, abi: ethers.Interface | ethers.InterfaceAbi = ERC20ABI, wallet: Wallet) {
        this.contract = new Contract(address, abi, wallet);
        this.decimals = decimals;
        this.wallet = wallet;
    }

    static fromToken(token: Token, wallet : Wallet): Erc20Contract {
        return new Erc20Contract(token.address, token.decimals, ERC20ABI, wallet);
    }

    async hasEnoughAllowance(ownerAddress: string, spenderAddress: string, amount : Decimal): Promise<boolean> {
        const value = await this.contract.allowance(ownerAddress, spenderAddress);

        const valueBigInt = BigInt(value.toString());
        const amountBigInt = amount.toBigInt(this.decimals);

        debug("hasEnoughAllowance ownerAddress=%s, spenderAddress=%s, value=%s, amountBigInt=%s", ownerAddress, spenderAddress, value, amountBigInt);

        // Return it
        return valueBigInt >= amountBigInt;
    }

    async allowanceOf(ownerAddress: string, spenderAddress: string): Promise<Decimal> {
        const value = await this.contract.allowance(ownerAddress, spenderAddress);

        debug("balanceOf ownerAddress=", ownerAddress, "spenderAddress=", spenderAddress, "return=", value);

        // Shift to decimal
        const decimal = DecimalUtil.fromBigNumberish(value, this.decimals);

        // Return it
        return decimal;
    }

    async balanceOf(holderAddress: string): Promise<Decimal> {
        const value = await this.contract.balanceOf(holderAddress);

        debug("balanceOf holderAddress=", holderAddress, "return=", value);

        // Shift to decimal
        const decimal = DecimalUtil.fromBigNumberish(value, this.decimals);

        // Return it
        return decimal;
    }

    async approve(spenderAddress: string, amount: Decimal = new Decimal(0)): Promise<ClientTransactionResponse> {
        // Get the big number
        let value: BigInt;

        if (amount.gt(0))
            value = DecimalUtil.toBigInt(amount, this.decimals);
        else
            value = ethers.MaxUint256;

        debug("approve spenderAddress=", spenderAddress, "amount=", amount, "value=", value);

        // Approve
        const response: TransactionResponse = await this.contract.approve(spenderAddress, value);

        debug("approve response=", response);

        // Do it
        const returnValue = await TransactionHelper.resolveTransactionResponse(response);

        debug("approve returnValue=", returnValue);

        // Return them
        return (returnValue);
    }
}