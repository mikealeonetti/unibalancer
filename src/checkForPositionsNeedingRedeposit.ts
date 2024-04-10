import { Op } from "sequelize";

import Debug from 'debug';
import { DBPosition } from "./database/models/DBPosition";
import PositionManager, { PositionInfo } from "./helpers/PositionManager";
import logger from "./logger";

const debug = Debug("unibalancer:checkForPositionsNeedingRerdeposits");

export default async function (positionInfos: PositionInfo[]): Promise<void> {
    // Get all positions needing redeposit
    const dbPositions = await DBPosition.findAll({ where: { redepositAttemptsRemaining: { [Op.gt]: 0 } } });

    debug( "Positions needing redeposit", dbPositions );

    // Loop all
    for( const dbPosition of dbPositions ) {
        // Find in the positions
        const psoitionInfo = positionInfos.find( p=>p.positionId.toString()==dbPosition.positionId );

        if( !psoitionInfo ) {
            // Didn't hav eit?
            logger.warn( "Could not find position [%s] but wants to be re-deposited.", dbPosition.positionId );
        }

        // Bingo bongo
        dbPosition.redepositAttemptsRemaining = dbPosition.redepositAttemptsRemaining-1;

        // Save it
        await dbPosition.save();

        logger.info( "Attempting to re-deposit [%s]. %d attempts left.", dbPosition.positionId, dbPosition.redepositAttemptsRemaining );

        // Now attempt to re-deposit
        await PositionManager.mintOrIncreasePosition( psoitionInfo );
    }
}