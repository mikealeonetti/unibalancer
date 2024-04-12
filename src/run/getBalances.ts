import { wethContract } from "../contracts/WethContract";
import usdcContract from "../contracts/usdcContract";
import BalanceHelpers from "../helpers/BalanceHelpers";
import { userWallet } from "../network";

(async function (): Promise<void> {
        // Get the balance of eths
        const ethBalance = await BalanceHelpers.ethBalance();
        const usdcBalance = await usdcContract.balanceOf(userWallet.address);
        const wethBalance = await wethContract.balanceOf(userWallet.address);

        console.log("ethBalance=%s", ethBalance);
        console.log("usdcBalance=%s", usdcBalance);
        console.log("wethBalacne=%s", wethBalance);

})();