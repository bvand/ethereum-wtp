const WinThePot = artifacts.require("WinThePot");

contract("WinThePot", function(accounts) {
    it("should initialize contract with expected owner", function() {
        return WinThePot.deployed().then(function(instance) {
            return instance.getOwner();
        }).then(function(owner) {
            assert.equal(owner, accounts[0]);
        });
    });
});