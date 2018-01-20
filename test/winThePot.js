const WinThePot = artifacts.require("WinThePot");
const BigNumber = require('bignumber.js');

contract("WinThePot", function(accounts) {
    let contract;
    let contribute;
    let checkContribution;

    const inProgressState = 0;
    const completeState = 1;
    const oneEther = new BigNumber('1e18');
    const twoEther = oneEther.mul(2);
    const testThreshold = twoEther.mul(5); // this will change once Oraclize is used
    const zero = new BigNumber(0);

    const owner = accounts[0];
    const account1 = accounts[1];
    const account2 = accounts[2];

    beforeEach(async function () {
        contract = await WinThePot.new();
        contribute = async (account, etherValue) => {
            await contract.sendTransaction({
                from: account,
                value: web3.toWei(etherValue, "ether")
            });
        };
        checkContribution = async (account, expectedValue, expectedIndex) => {
            const contribution = await contract.getContribution(account);
            const value = contribution[0];
            const gameIndex = contribution[1];
    
            assert.isTrue(value.equals(expectedValue));
            assert.isTrue(gameIndex.equals(expectedIndex));
        }
    });

    it("should initialize contract with expected owner, state, and time", async function() {
        assert.equal(await contract.owner(), owner);
        assert.equal(await contract.currentPotStartTime(), web3.eth.getBlock(web3.eth.blockNumber).timestamp);
        assert.equal(await contract.state(), inProgressState);
    });

    it("should allow single contribution", async function() {
        const potPreSend = await contract.currentPot();
        assert.isTrue(potPreSend.equals(zero));

        contribute(account1, 1);
        checkContribution(account1, oneEther, zero);

        const potPostSend = await contract.currentPot();
        assert.isTrue(potPostSend.equals(oneEther));
    });

    it("should allow multiple contributions", async function() {
        await contribute(account1, 2);
        await checkContribution(account1, twoEther, 0);
        await contribute(account2, 2);
        await checkContribution(account2, twoEther, 0);

        const potPostSend = await contract.currentPot();
        assert.isTrue(potPostSend.equals(twoEther.mul(2)));
    });

    it("should complete and record game with last contributor if pot goes over threshold", async function() {
        await contribute(account1, 2);
        await contribute(account2, 2);
        await contribute(accounts[3], 2);
        await contribute(accounts[4], 2);
        await contribute(accounts[5], 2);

        assert.equal(await contract.state(), completeState);
        
        const game = await contract.getGame(0);
        assert.equal(false, game[0]);
        assert.equal(accounts[5], game[1]);
        assert.isTrue(testThreshold.equals(game[2]));
        assert.isTrue(testThreshold.equals(game[3]));
    });
});