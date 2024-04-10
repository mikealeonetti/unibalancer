import { Contract, JsonRpcProvider } from "ethers";

const ARB_GASINFO_ADDRESS = "0x000000000000000000000000000000000000006C";

const _abi = [
    {
        inputs: [],
        name: "getPricesInWei",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];

(async function(){
    //const provider = new JsonRpcProvider("https://arb-pokt.nodies.app");
    const provider = new JsonRpcProvider("http://127.0.0.1:8545");
    const contract = new Contract(ARB_GASINFO_ADDRESS, _abi, provider);

    const blockTag = await provider.getBlockNumber();

    console.log( "blockTag=", blockTag );

    const result = await contract.getPricesInWei({
        blockTag
    });

    console.log( "result=", result );
})();