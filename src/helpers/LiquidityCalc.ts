import Decimal from "decimal.js";

import Debug from 'debug';
import { Currency, CurrencyAmount, Fraction } from "@uniswap/sdk-core";
import { Position, SqrtPriceMath, TickMath } from "@uniswap/v3-sdk";
import JSBI from "jsbi";

const debug = Debug("unibalancer:helpers:LiquidityCalc");

export default class LiquidityCalc {
    private constructor() {

    }

    static getLiquidityYFromX(x: Decimal, price: Decimal, priceHigh: Decimal, priceLow: Decimal): Decimal {

        const L = x.times(
            Decimal.sqrt(price)
                .mul(Decimal.sqrt(priceHigh))
                .div(Decimal.sqrt(priceHigh).minus(Decimal.sqrt(price)))
        );

        debug("L=%s", L);

        const y = L.times(Decimal.sqrt(price).minus(Decimal.sqrt(priceLow)));

        debug("y=%s", y);

        return (y);
    }

    static calculateOptimalRatio(position: Position, sqrtRatioX96: JSBI, zeroForOne: boolean): Fraction {
        const upperSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickUpper);
        const lowerSqrtRatioX96 = TickMath.getSqrtRatioAtTick(position.tickLower);

        debug("upperSqrtRatioX96=%s, lowerSqrtRatioX96=%s", upperSqrtRatioX96, lowerSqrtRatioX96);

        // returns Fraction(0, 1) for any out of range position regardless of zeroForOne. Implication: function
        // cannot be used to determine the trading direction of out of range positions.
        if (JSBI.greaterThan(sqrtRatioX96, upperSqrtRatioX96) ||
            JSBI.lessThan(sqrtRatioX96, lowerSqrtRatioX96)) {
            return new Fraction(0, 1);
        }
        const precision = JSBI.BigInt('1' + '0'.repeat(18));

        const optimalRatioNumerator = SqrtPriceMath.getAmount0Delta(sqrtRatioX96, upperSqrtRatioX96, precision, true);
        const optimalRatioDenominator = SqrtPriceMath.getAmount1Delta(sqrtRatioX96, lowerSqrtRatioX96, precision, true);

        debug("optimalRatioNumerator=%s, optimalRatioDenominator=%s", optimalRatioNumerator, optimalRatioDenominator);

        let optimalRatio = new Fraction(optimalRatioNumerator, optimalRatioDenominator);

        debug("1 optimalRatio numerator=%s, denominator=%s, quotient=%s", optimalRatio.numerator, optimalRatio.denominator, optimalRatio.quotient);

        if (!zeroForOne)
            optimalRatio = optimalRatio.invert();


        debug("2 optimalRatio numerator=%s, denominator=%s, quotient=%s", optimalRatio.numerator, optimalRatio.denominator, optimalRatio.quotient);

        return optimalRatio;
    }

    static calculateRatioAmountIn<T extends Currency>(optimalRatio: Fraction,
        inputTokenPrice: Fraction,
        inputBalance: CurrencyAmount<T>,
        outputBalance: CurrencyAmount<T>): CurrencyAmount<T> {
        // formula: amountToSwap = (inputBalance - (optimalRatio * outputBalance)) / ((optimalRatio * inputTokenPrice) + 1))
        const amountToSwapRaw = new Fraction(inputBalance.quotient)
            .subtract(optimalRatio.multiply(outputBalance.quotient))
            .divide(optimalRatio.multiply(inputTokenPrice).add(1));

        debug("amountToSwapRaw=%s", amountToSwapRaw.quotient);

        if (amountToSwapRaw.lessThan(0)) {
            // should never happen since we do checks before calling in
            throw new Error('routeToRatio: insufficient input token amount');
        }
        return CurrencyAmount.fromRawAmount(inputBalance.currency, amountToSwapRaw.quotient);
    }

    static getRatio<T extends Currency>(token0Balance: CurrencyAmount<T>,
        token1Balance: CurrencyAmount<T>,
        position: Position) {
        // See which token comes first
        if (token1Balance.currency.wrapped.sortsBefore(token0Balance.currency.wrapped)) {
            debug("Switching position");
            [token0Balance, token1Balance] = [token1Balance, token0Balance];
        }

        let preSwapOptimalRatio = this.calculateOptimalRatio(position, position.pool.sqrtRatioX96, true);

        // set up parameters according to which token will be swapped
        let zeroForOne;

        if (position.pool.tickCurrent > position.tickUpper) {
            debug("Tick current exceeds position");
            zeroForOne = true;
        }
        else if (position.pool.tickCurrent < position.tickLower) {
            debug("Tick current under position");
            zeroForOne = false;
        }
        else {
            zeroForOne = new Fraction(token0Balance.quotient, token1Balance.quotient).greaterThan(preSwapOptimalRatio);

            debug("Last cast");

            if (!zeroForOne)
                preSwapOptimalRatio = preSwapOptimalRatio.invert();
        }

        debug("zeroForOne=%s", zeroForOne);

        const [inputBalance, outputBalance] = zeroForOne
            ? [token0Balance, token1Balance]
            : [token1Balance, token0Balance];


        let optimalRatio = preSwapOptimalRatio;
        let exchangeRate = zeroForOne
            ? position.pool.token0Price
            : position.pool.token1Price;

        const amountToSwap = this.calculateRatioAmountIn(optimalRatio, exchangeRate, inputBalance, outputBalance);

        debug("inputToken=%s, outputToken=%s", inputBalance.currency.name, outputBalance.currency.name  );
        debug("amountToSwap numerator=%s, denominator=%s, quotient=%s", amountToSwap.numerator, amountToSwap.denominator, amountToSwap.quotient);

        return amountToSwap;
    }
}