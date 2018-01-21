const WinThePot = artifacts.require("WinThePot");
const BigNumber = require('bignumber.js');

contract("WinThePot", (accounts) => {
    let contract;
    let contribute;
    let checkContribution;
    let checkGame;

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
    const account3 = accounts[3];

    const fail = (message) => {
        throw new Error(message);
    }

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
    
            assert.isTrue(value.equals(expectedValue), `expected value to equal ${expectedValue} but was ${value}`);
            assert.isTrue(gameIndex.equals(expectedIndex), `expected index to equal ${expectedIndex} but was ${gameIndex}`);
        }
        checkGame = async (expectedWinner, expectedAllCanWithdraw, expectedWinnings) => {
            const game = await contract.getGame(0);
            assert.equal(expectedAllCanWithdraw, game[0], `expected allCanWithdraw to equal ${expectedAllCanWithdraw} but was ${game[0]}`);
            assert.equal(expectedWinner, game[1], `expected winner to equal ${expectedWinner} but was ${game[1]}`);
            assert.isTrue(expectedWinnings.equals(game[2]), `expected winnings to equal ${expectedWinnings} but was ${game[2]}`);
            assert.isTrue(testThreshold.equals(game[3]), `expected threshold to equal ${testThreshold} but was ${game[3]}`);
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
        await contribute(account3, 4);

        assert.equal(await contract.state(), completeState);
        await checkGame(account3, false, testThreshold);
    });

    it("should allow withdrawing contribution if time expires and new game begins", async () => {
        await contribute(account1, 2);
        await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [threeHours], id: new Date().getTime()});
        await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: new Date().getTime()});
        await contract.startNewGame();

        const transaction = await contract.withdrawContribution({from: account1});
        const logs = transaction.logs;
        assert.equal(1, logs.length);

        const log = logs[0];
        assert.equal("ContributionWithdrawal", log.event);
        assert.equal(account1, log.args.to);
        assert.isTrue(log.args.success);
        assert.isTrue(log.args.value.equals(twoEther));
        checkContribution(account1, 0, 0);
    });

    it("should not allow withdrawing contribution before time expires", async () => {
        await contribute(account1, 2);
        const contributionBefore = await contract.getContribution(account1);
        try {
            await contract.withdrawContribution({from: account1});
            fail("contribution withdrawal should fail");
        } catch (e) {
            assert.equal("Error: VM Exception while processing transaction: revert", e.toString());
            const contributionAfter = await contract.getContribution(account1);
            assert.isTrue(contributionBefore[0].equals(contributionAfter[0]), `Expected contribution value to equal ${contributionBefore[0]} but was ${contributionAfter[0]}`);
            assert.isTrue(contributionBefore[1].equals(contributionAfter[1]), `Expected game index to equal ${contributionBefore[1]} but was ${contributionAfter[1]}`);
        }
    });

    it("should allow withdrawing winnings if you won", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        const transaction = await contract.withdrawWinnings({from: account3});
        const logs = transaction.logs;
        assert.equal(1, logs.length);

        const log = logs[0];
        assert.equal("WinningsWithdrawal", log.event);
        assert.equal(account3, log.args.to);
        assert.isTrue(log.args.success);
        assert.isTrue(log.args.value.equals(testThreshold));

        await checkGame(account3, false, zero);
    });

    it("should not allow withdrawing winnings if you contributed to a game where you didn't win", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        try {
            await contract.withdrawWinnings({from: account1});
            fail("winnings withdrawal should fail");
        } catch (e) {
            assert.equal("Error: VM Exception while processing transaction: revert", e.toString());
            await checkGame(account3, false, testThreshold);
        }
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