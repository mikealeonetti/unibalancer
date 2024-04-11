import { Currency, CurrencyAmount, Percent, Price } from '@uniswap/sdk-core';
import Decimal from 'decimal.js';
import { BigNumberish } from 'ethers';

import Debug from 'debug';

const debug = Debug("unibalancer:helpers:swapToken");

declare module "@uniswap/sdk-core" {
    interface Price<TBase extends Currency, TQuote extends Currency> {
        toDecimal(): Decimal;
    }
    interface CurrencyAmount<T extends Currency> {
        toDecimal(): Decimal;
    }
}

declare module "decimal.js" {
    interface Decimal {
        toCurrencyAmount<T extends Currency>(token: T): CurrencyAmount<T>;
        toBigIntString(shiftRight: number): string;
        adjustDecimalsLeft(shiftLeft: number): Decimal;
        adjustDecimalsRight(shiftRight: number): Decimal;
        toPercent() : Percent;
        toBigInt(shiftRight : number): bigint;
    }

}

Decimal.prototype.toBigInt = function(shiftRight : number= 0): bigint {
    // First convert to string
    const inputAsString = this.toBigIntString(shiftRight);

    // Now to BigInt
    const bigInt = BigInt(inputAsString);

    return bigInt;
}
Decimal.prototype.toPercent = function(): Percent {
    const [fractionNumerator, fractionDenominator] = this.toFraction().map(d=>d.toFixed());

    debug( "fractionNumerator=%s, fractionDenominator=%s", fractionNumerator, fractionDenominator );

    return new Percent(fractionNumerator, fractionDenominator);
};
Decimal.prototype.adjustDecimalsLeft = function (shiftLeft: number): Decimal {
    const divideBy = Decimal.pow(10, shiftLeft);

    return this.div(divideBy);
};
Decimal.prototype.adjustDecimalsRight = function (shiftRight: number): Decimal {
    const divideBy = Decimal.pow(10, shiftRight);

    return this.mul(divideBy);
};
Decimal.prototype.toBigIntString = function (shiftRight: number = 0): string {
    if (this.isNeg())
        throw new Error(`Negative decimal value ${this} cannot be converted to BigInt.`);

    let newDecimal = new Decimal(this);

    if (shiftRight > 0)
        newDecimal = this.adjustDecimalsRight(shiftRight);

    // Make sure there are no zeroes
    newDecimal = newDecimal.trunc();

    debug( "newDecimal=%s", newDecimal );

    return newDecimal.toFixed();
};

Decimal.prototype.toCurrencyAmount = function <T extends Currency>(token: T): CurrencyAmount<T> {
    // Get the bigint
    const bigIntString = this.toBigIntString(token.decimals);

    debug( "toCurrencyAmount bigIntString=%s, token.decimals=%s", bigIntString, token.decimals );

    const currencyAmount = CurrencyAmount.fromRawAmount(
        token,
        bigIntString
    );

    return currencyAmount;
};


Price.prototype.toDecimal = function (): Decimal {
    return new Decimal(this.numerator.toString())
        .div(this.denominator.toString())
        .div(
            Decimal.pow(10, this.quoteCurrency.decimals)
                .div(Decimal.pow(10, this.baseCurrency.decimals))
        );
};
CurrencyAmount.prototype.toDecimal = function (): Decimal {
    const d = new Decimal(this.numerator.toString())
        .div(this.denominator.toString());

    return DecimalUtil.adjustDecimalsLeft(d, this.currency.decimals);
};

export default class DecimalUtil {
    static adjustDecimalsLeft(input: Decimal, shiftLeft: number): Decimal {
        const divideBy = Decimal.pow(10, shiftLeft);

        return input.div(divideBy);
    }
    static adjustDecimalsRight(input: Decimal, shiftRight: number): Decimal {
        const divideBy = Decimal.pow(10, shiftRight);

        return input.mul(divideBy);
    }

    static toPercent(input: Decimal): Percent {
        const [slippageNumerator, slippageDenominator] = input.toFraction().map(String);

        return new Percent(slippageNumerator, slippageDenominator);
    }

    static fromPrice<TBase extends Currency, TQuote extends Currency>(input: Price<TBase, TQuote>): Decimal {
        return new Decimal(input.toFixed());
    }

    static fromCurrencyAmount<T extends Currency>(input: CurrencyAmount<T>): Decimal {
        //return new Decimal( input.toFixed() );
        const d = new Decimal(input.numerator.toString())
            .div(input.denominator.toString());

        return DecimalUtil.adjustDecimalsLeft(d, input.currency.decimals);
    }

    static fromBigNumberish(input: BigNumberish, shiftLeft: number = 0) {
        const inputString = input.toString();

        let inputDecimal = new Decimal(inputString);

        // Shift?
        if (shiftLeft > 0)
            inputDecimal = this.adjustDecimalsLeft(inputDecimal, shiftLeft);

        return inputDecimal;
    }

    static toBigInt(inputDecimal: Decimal, shiftRight = 0): BigInt {
        // First convert to string
        const inputAsString = this.toBigIntString(inputDecimal, shiftRight);

        // Now to BigInt
        const bigInt = BigInt(inputAsString);

        return bigInt;
    }

    static toBigIntString(inputDecimal: Decimal, shiftRight = 0): string {
        if (inputDecimal.isNeg())
            throw new Error(`Negative decimal value ${inputDecimal} cannot be converted to BigInt.`);

        if (shiftRight > 0)
            inputDecimal = this.adjustDecimalsRight(inputDecimal, shiftRight);

        // Make sure there are no zeroes
        inputDecimal = inputDecimal.trunc();

        return inputDecimal.toFixed();
    }

    static toCurrencyAmount<T extends Currency>(token: T, inputDecimal: Decimal): CurrencyAmount<T> {
        // Get the bigint
        const bigIntString = this.toBigIntString(inputDecimal, token.decimals);

        const currencyAmount = CurrencyAmount.fromRawAmount(
            token,
            bigIntString
        );

        return currencyAmount;
    }
}