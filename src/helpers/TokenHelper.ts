import { memoize, toLower } from "lodash";
import { USDC_TOKEN, WETH_TOKEN } from "../constants";

export const getSymbolFromTokenAddress = memoize(function (address: string)  : string {
    address = toLower(address);

    if (toLower(WETH_TOKEN.address) == address)
        return ("weth");
    else if (toLower(USDC_TOKEN.address) == address)
        return ("usdc");

    return ("unknown token");
});