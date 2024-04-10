import collectFees from "../collectFees";
import { initializeDatabase } from "../database";
import PositionManager from "../helpers/PositionManager";
import resyncDatabasePositions from "../resyncDatabasePositions";

(async function() {
    await initializeDatabase();
    
    // Get all current positions
    const openPositionInfos = await PositionManager.getAllPositions();

    await resyncDatabasePositions(openPositionInfos);

    for( const positionInfo of openPositionInfos ) {
        console.log( "Collecting fees from %s", positionInfo.positionId);

        await collectFees(positionInfo);
        
        console.log( "Fees collected from %", positionInfo.positionId);
    }

    process.exit( 0 );
})();