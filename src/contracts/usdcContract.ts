import { USDC_TOKEN } from "../constants";
import { userWallet } from "../network";
import Erc20Contract from "./Erc20Contract";

export default Erc20Contract.fromToken(USDC_TOKEN, userWallet);