import { Price, Token } from "@uniswap/sdk-core";
import JSBI from "jsbi";


export default class PriceHelper {
    private constructor() {

    }

    static Q96 = /*#__PURE__*/JSBI.exponentiate( /*#__PURE__*/JSBI.BigInt(2), /*#__PURE__*/JSBI.BigInt(96));
    static Q192 = /*#__PURE__*/JSBI.exponentiate(this.Q96, /*#__PURE__*/JSBI.BigInt(2));

    static sqrtRatioX96ToPrice(baseToken: Token, quoteToken: Token, sqrtRatioX96: bigint): Price<Token, Token> {

        const sqrtRatioX96JSBI = JSBI.BigInt(sqrtRatioX96.toString());

        var ratioX192 = JSBI.multiply(sqrtRatioX96JSBI, sqrtRatioX96JSBI);

        return baseToken.sortsBefore(quoteToken) ?
            new Price(baseToken, quoteToken, this.Q192, ratioX192) :
            new Price(baseToken, quoteToken, ratioX192, this.Q192);
    }
}