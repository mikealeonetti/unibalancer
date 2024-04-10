import { initializeDatabase } from "../database";
import { alertViaTelegram } from "../telegram";

(async function(){
    await initializeDatabase();
    
    await alertViaTelegram("Test");
})();