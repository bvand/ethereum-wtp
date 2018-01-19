const WinThePot = artifacts.require("WinThePot");
const BigNumber = require('bignumber.js');

contract("WinThePot", function(accounts) {
    let contract;

    const inProgressState = 0;
    const completeState = 1;
    const oneEther = new BigNumber('1e18');
    const zero = new BigNumber(0);

    const owner = accounts[0];
    const account1 = accounts[1];

    beforeEach(async function () {
        contract = await WinThePot.new();
    });

    it("should initialize contract with expected owner, state, and time", async function() {
        assert.equal(await contract.owner(), owner);
        assert.equal(await contract.currentPotStartTime(), web3.eth.getBlock(web3.eth.blockNumber).timestamp);
        assert.equal(await contract.state(), inProgressState);
    });

    it("should allow single contribution", async function() {
        const potPreSend = await contract.currentPot();
        assert.isTrue(potPreSend.equals(zero));

        await contract.sendTransaction({
            from: account1,
            value: web3.toWei(1, "ether")
        });

        const potPostSend = await contract.currentPot();
        const contribution = await contract.getContribution(account1);
        const value = contribution[0];
        const gameIndex = contribution[1];

        assert.isTrue(potPostSend.equals(oneEther));
        assert.isTrue(value.equals(oneEther));
        assert.isTrue(gameIndex.equals(zero));
    });
});