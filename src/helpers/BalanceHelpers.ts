import Decimal from "decimal.js";
import { MAXIMUM_GAS_TO_SAVE, MINIMUM_GAS_TO_SAVE, USDC_TOKEN, WETH_TOKEN } from "../constants";
import { provider, userWallet } from "../network";
import DecimalUtil from "./DecimalUtil";

import { CurrencyAmount, Token } from "@uniswap/sdk-core";
import Debug from 'debug';
import { wethContract } from "../contracts/WethContract";
import usdcContract from "../contracts/usdcContract";

import { DBProperty } from "../database";
import logger from "../logger";
import TransactionHelper from './TransactionHelper';

const debug = Debug("unibalancer:helpers:BalanceHelpers");

type WethUsdcBalanceAsCurrencyAmounts = [CurrencyAmount<Token>, CurrencyAmount<Token>];

export default class BalanceHelpers {
    static async ethBalance(address: string = userWallet.address): Promise<Decimal> {
        debug("ethBalance of %s", address);

        const balanceBn = await provider.getBalance(address);

        debug(
            "ethBalance balanceBn=", balanceBn
        );

        return DecimalUtil.fromBigNumberish(balanceBn, WETH_TOKEN.decimals);
    }

    private static async wethUsdcBalanceAsCurrencyAmount(address: string = userWallet.address): Promise<WethUsdcBalanceAsCurrencyAmounts> {
        const amounts = await Promise.all([
            wethContract.balanceOf(address),
            usdcContract.balanceOf(address)
        ]) as [Decimal, Decimal];

        // Convert
        return ([
            DecimalUtil.toCurrencyAmount(WETH_TOKEN, amounts[0]),
            DecimalUtil.toCurrencyAmount(USDC_TOKEN, amounts[1]),
        ]);
    }

    static async adjustedWethUsdcBalanceAsCurrencyAmount(address: string = userWallet.address): Promise<WethUsdcBalanceAsCurrencyAmounts> {
        // Get the withholdings and the balance
        const [
            wethBalance,
            usdcBalance,
            wethHoldings,
            usdcHoldings
        ] = await Promise.all([
            wethContract.balanceOf(address),
            usdcContract.balanceOf(address),
            DBProperty.getTokenHoldings("weth"),
            DBProperty.getTokenHoldings("usdc")
        ]);

        // Now adjust
        const adjustedWethBalance = Decimal.max(0, wethBalance.minus(wethHoldings));
        const adjustedUsdcBalance = Decimal.max(0, usdcBalance.minus(usdcHoldings));

        debug("adjustedWethBalance=%s, adjustedUsdcBalance=%s", adjustedWethBalance, adjustedUsdcBalance);

        // Returnify
        return ([
            adjustedWethBalance.toCurrencyAmount(WETH_TOKEN),
            adjustedUsdcBalance.toCurrencyAmount(USDC_TOKEN)
        ]);
    }

    static async wrapEthToMaintainWeth(): Promise<void> {
        // Get the balance of weth
        const ethBalance = await this.ethBalance();

        // How much do we want?
        const ethToWrap = ethBalance.minus(MAXIMUM_GAS_TO_SAVE);

        debug("wrapEthToMaintainWeth ethToWrap=%s", ethToWrap);

        // Do we have some we need to sell?
        if (ethToWrap.gt(0)) {
            // Get how
            debug("wrapEthToMaintainWeth Wanting to wrap %s eth.", ethToWrap);

            // Wrap it
            const clientTransactionResponse = await wethContract.wrapEth(ethToWrap);

            // Add the bass
            await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, "wrap weth");
        }
    }

    static async unwrapEthToMaintainEth(): Promise<void> {
        const [wethBalance] = await this.adjustedWethUsdcBalanceAsCurrencyAmount();
        const [
            ethBalance
        ] = await Promise.all([
            this.ethBalance()
        ]);

        debug("unwrapEthToMaintainEth ethBalance=%s, wethbalance=%s", ethBalance, wethBalance.toFixed());

        // Do we have to perform an unwrap
        if (ethBalance.gte(MINIMUM_GAS_TO_SAVE)) {
            debug("unwrapEthToMaintainEth have enough no need to unwrap.");
            return;
        }

        // We do have to unwrap!
        // How much do we need?
        const wantedGasToUnwrap = new Decimal(MAXIMUM_GAS_TO_SAVE).minus(ethBalance);

        debug("unwrapEthToMaintainEth gasToUnwrap=%s", wantedGasToUnwrap);

        // Adjust to wethBalance
        const actualGasToUnwrap = Decimal.min(wantedGasToUnwrap, wethBalance.toDecimal());

        debug("unwrapEthToMaintainEth adjusted actualGasToUnwrap=%s", actualGasToUnwrap);

        if (actualGasToUnwrap.lte(0)) {
            logger.warn("Wanted to unwrap %s but we don't have any weth to unwrap.", wantedGasToUnwrap);
            return;
        }

        // Unwrip
        const clientTransactionResponse = await wethContract.unwrapEth(actualGasToUnwrap);

        // Add the bass
        await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, "unwrap weth");
    }
}