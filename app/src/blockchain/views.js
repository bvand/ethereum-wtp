import * as Web3 from 'web3';
const iweb3 = new Web3(new Web3.providers.HttpProvider('http://127.0.0.1:8545'));
const addr = "0xcae4c0b0a3f6bc2b9d1a8b1e77c510b89a606610";

export const viewBalance = async (amount) => {
    return iweb3.eth.getBalance(addr, "latest", (error, result) => {
        console.log("error: ", error);
        console.log("result: ", result);
    });
}