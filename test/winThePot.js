const WinThePot = artifacts.require("WinThePot");

contract("WinThePot", function(accounts) {
    let contract;

    const account = accounts[1];
    const offerName = "Purchase discount";

    beforeEach(async function () {
        contract = await WinThePot.new();
    });

    it("should initialize contract with expected owner", async function() {
        const owner = await contract.owner();
        assert.equal(owner, accounts[0]);
    });
});