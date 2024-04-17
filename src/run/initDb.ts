import { initializeDatabase } from "../database";

(async function(){
    await initializeDatabase();
    process.exit(0);
})();