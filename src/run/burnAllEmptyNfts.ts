
import { TransactionResponse } from 'ethers';
import { REFUSE_BURN_NFT_GAS_ABOVE } from '../constants';
import nftTokenContract from '../contracts/nftTokenContract';
import { initializeDatabase } from '../database';
import PositionManager, { GetPositionsType, PositionInfo } from "../helpers/PositionManager";
import TransactionHelper from '../helpers/TransactionHelper';
import { ClientTransactionResponse } from '../types';

async function burnNftFromPositionInfo(positionInfo: PositionInfo): Promise<ClientTransactionResponse | null> {
    const { positionId } = positionInfo;

    // Call options
    const transferParams = [
        positionId
    ];

    // First esimate the gas
    const estimatedGas = await TransactionHelper.estimateGasFromPromise(
        nftTokenContract.burn.estimateGas(...transferParams)
    );

    console.log("gasEsimate=%s", estimatedGas);

    console.log("Estimated gas to burn NFT %s vs %s", estimatedGas, REFUSE_BURN_NFT_GAS_ABOVE);

    if (estimatedGas.gt(REFUSE_BURN_NFT_GAS_ABOVE)) {
        console.warn("Gas %s is too high to burn NFT [%s]. Refusing to burn.", estimatedGas.toFixed(), positionId);
        return null;
    }

    // Do the transfer
    const transactionResponse: TransactionResponse = await nftTokenContract.burn(...transferParams);

    console.log("transactionResponse=", transactionResponse);

    // Wait for it
    const clientTransactionResponse = await TransactionHelper.resolveTransactionResponse(transactionResponse);

    // Make sure to add to the deficit
    await TransactionHelper.addDeficitFromTransaction(clientTransactionResponse, `burned NFT ${positionId}.`);

    return clientTransactionResponse;
}

async function checkForNftsToBurn() {
    // Get all burnable nfts
    const emptyLiquidityPostions = await PositionManager.getAllPositions(GetPositionsType.HasNoLiquidity);

    console.log("emptyLiquidityPostions=", emptyLiquidityPostions);

    // Loop through and then burn
    for (const positionInfo of emptyLiquidityPostions) {
        // Do we have reawrds to collect?
        const {
            positionId,
            tokensOwed0,
            tokensOwed1
        } = positionInfo;

        console.log("tokensOwed0=%s, tokensOwed1=%s", tokensOwed0, tokensOwed1);

        if (tokensOwed0.gt(0) || tokensOwed1.gt(0)) {
            console.warn("We can't burn NFT %s because it still has fees to collect!", tokensOwed0, tokensOwed1);
            continue;
        }

        // Burn it
        await burnNftFromPositionInfo(positionInfo);

        console.log( "Burned NFT [%s].", positionId);
    }
}

(async function(){
    await initializeDatabase();

    await checkForNftsToBurn();
})();