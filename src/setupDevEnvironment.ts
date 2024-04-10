import { provider } from "./network";


(async function(){
    try {
        // Binance hot wallet
        //0xb38e8c17e38363af6ebdcb3dae12e0243582891d

        // Impersonate somebody else 
        let r = await provider.send( "anvil_impersonateAccount", [
            "0xb38e8c17e38363af6ebdcb3dae12e0243582891d"
        ]);

        console.log( "impersonate r=", r );

        // Now send money
        //r = await usdc.transfer( PUBLIC_KEY, ethers.parseUnits( "10000", USDC_TOKEN.decimals ) );

        console.log( "transfer r=", r );
    }
    catch( e ) {
        console.error( "Exiting error", e );
        process.exit( 1 );
    }

    process.exit( 0 );
})();