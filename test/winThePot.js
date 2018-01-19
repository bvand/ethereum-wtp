const WinThePot = artifacts.require("WinThePot");
const BigNumber = require('bignumber.js');

contract("WinThePot", function(accounts) {
    let contract;

    const account = accounts[1];

    beforeEach(async function () {
        contract = await WinThePot.new();
    });

    it("should initialize contract with expected owner, state, time, and threshold", async function() {
        assert.equal(await contract.owner(), accounts[0]);
        assert.equal(await contract.currentPotStartTime(), web3.eth.getBlock(web3.eth.blockNumber).timestamp);
        assert.equal(await contract.state(), 0);
    });
});