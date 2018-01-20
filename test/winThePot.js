const WinThePot = artifacts.require("WinThePot");
const BigNumber = require('bignumber.js');

contract("WinThePot", (accounts) => {
    let contract;
    let contribute;
    let checkContribution;

    const inProgressState = 0;
    const completeState = 1;
    const oneEther = new BigNumber('1e18');
    const twoEther = oneEther.mul(2);
    const testThreshold = twoEther.mul(5); // this will change once Oraclize is used
    const zero = new BigNumber(0);
    const threeHours = 3 * 3600;

    const owner = accounts[0];
    const account1 = accounts[1];
    const account2 = accounts[2];

    beforeEach(async () => {
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
    
            assert.isTrue(value.equals(expectedValue), `expected value ${value} to equal ${expectedValue}`);
            assert.isTrue(gameIndex.equals(expectedIndex), `expected index ${gameIndex} to equal ${expectedIndex}`);
        }
    });

    it("should initialize contract with expected owner, state, and time", async () => {
        assert.equal(await contract.owner(), owner);
        assert.equal(await contract.currentPotStartTime(), web3.eth.getBlock(web3.eth.blockNumber).timestamp);
        assert.equal(await contract.state(), inProgressState);
    });

    it("should allow single contribution", async () => {
        const potPreSend = await contract.currentPot();
        assert.isTrue(potPreSend.equals(zero));

        contribute(account1, 1);
        checkContribution(account1, oneEther, zero);

        const potPostSend = await contract.currentPot();
        assert.isTrue(potPostSend.equals(oneEther));
    });

    it("should allow multiple contributions", async () => {
        await contribute(account1, 2);
        await checkContribution(account1, twoEther, 0);
        await contribute(account2, 2);
        await checkContribution(account2, twoEther, 0);

        const potPostSend = await contract.currentPot();
        assert.isTrue(potPostSend.equals(twoEther.mul(2)));
    });

    it("should complete and record game with last contributor if pot goes over threshold", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(accounts[3], 4);

        assert.equal(await contract.state(), completeState);
        
        const game = await contract.getGame(0);
        assert.equal(false, game[0]);
        assert.equal(accounts[3], game[1]);
        assert.isTrue(testThreshold.equals(game[2]));
        assert.isTrue(testThreshold.equals(game[3]));
    });

    it("should allow withdrawing contribution if time expires and new game begins", async () => {
        await contribute(account1, 2);
        const startTime = await web3.eth.getBlock(web3.eth.blockNumber).timestamp;
        await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [threeHours], id: new Date().getTime()});
        await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: new Date().getTime()});
        await contract.startNewGame();

        const transaction = await contract.withdrawContribution({from: account1});
        const logs = transaction.logs;
        assert.equal(1, logs.length);

        const log = logs[0];
        assert.equal("Withdrawal", log.event);
        assert.equal(account1, log.args.to);
        assert.isTrue(log.args.success);
        assert.isTrue(log.args.value.equals(twoEther));
        checkContribution(account1, 0, 0);
    });

    it("should not allow withdrawing contribution before time expires", async () => {

    });

    it("should allow withdrawing winnings if you won", async () => {

    });

    it("should not allow withdrawing winnings if you contributed to a game where you didn't win", async () => {

    });

    it("should successfully start new game and record previous if time expires", () => {

    });

    it("should fail to startNewGame if time hasn't expired", async () => {

    });

    // TODO: update implementation to enable this. currently doesn't work because contribution persists after game completion.
    // idea: check on each contribution if previous should be erased
    it("should allow you to contribute again if you lose a game", async () => {

    });
});