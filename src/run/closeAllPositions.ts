import closePosition from "../closePosition";
import { initializeDatabase } from "../database";
import { DBPosition } from "../database/models/DBPosition";
import PositionManager from "../helpers/PositionManager";
import resyncDatabasePositions from "../resyncDatabasePositions";

(async function() {
    await initializeDatabase();
    
    // Get all current positions
    const openPositionInfos = await PositionManager.getAllPositions();

    await resyncDatabasePositions(openPositionInfos);

    for( const positionInfo of openPositionInfos ) {
        // Get from the db
        const dbPosition = await DBPosition.getByPositionId(positionInfo.positionId);

        // Close it
        if( dbPosition!=null )
            await closePosition(positionInfo, dbPosition);
        else
            console.log( "Cannot position in database %s", positionInfo.positionId);
    }

    process.exit( 0 );
})();