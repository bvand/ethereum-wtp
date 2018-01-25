const WinThePot = artifacts.require("WinThePot");
const BigNumber = require('bignumber.js');

contract("WinThePot", (accounts) => {
    let contract;
    let contribute;
    let checkContribution;
    let checkGame;
    let fastForward;

    const inProgressState = 0;
    const completeState = 1;
    const oneEther = new BigNumber('1e18');
    const twoEther = oneEther.mul(2);
    const testThreshold = twoEther.mul(5); // this will change once Oraclize is used
    const zero = new BigNumber(0);
    const oneHour = 3600;
    const threeHours = 3 * 3600;
    const requireFailureMessage = "Error: VM Exception while processing transaction: revert";

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
            await contract.contribute({
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

        checkGame = async (expectedWinner, expectedAllCanWithdraw, expectedWinnings, expectedThreshold) => {
            const game = await contract.getGame(0);
            assert.equal(expectedAllCanWithdraw, game[0], "allCanWithdraw didn't match expected");
            assert.equal(expectedWinner, game[1], "winner didn't match expected");
            assert.isTrue(expectedWinnings.equals(game[2]), `expected winnings to equal ${expectedWinnings} but was ${game[2]}`);
            assert.isTrue(expectedThreshold.equals(game[3]), `expected threshold to equal ${testThreshold} but was ${game[3]}`);
        }

        fastForward = async (time) => {
            await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [time], id: new Date().getTime()});
            await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: new Date().getTime()});
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

    it("should allow multiple contributions from different addresses in the same game", async () => {
        await contribute(account1, 2);
        await checkContribution(account1, twoEther, 0);
        await contribute(account2, 2);
        await checkContribution(account2, twoEther, 0);

        const potPostSend = await contract.currentPot();
        assert.isTrue(potPostSend.equals(twoEther.mul(2)));
    });

    it("should allow you to contribute to another game if you lose earlier game", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        await fastForward(threeHours);
        await contract.startNewGame();

        await contribute(account1, 1);
        await checkContribution(account1, oneEther, 1);
        assert.equal(await contract.state(), inProgressState);
        const secondGamePot = await contract.currentPot();
        assert.isTrue(secondGamePot.equals(oneEther));
    });

    it("should not allow contribution when game is complete", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        try {
            await contribute(accounts[4], 1);
            fail("contribution should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
        }
    });

    it("should not allow contributions below minimum", async () => {
        try {
            await contribute(account1, 0.09);
            fail("contribution should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
        }
    });

    it("should not allow contributions above maximum", async () => {
        try {
            await contribute(account1, 4.1);
            fail("contribution should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
        }
    });

    it("should not allow you to contribute twice during the same game", async () => {
        await contribute(account1, 2);
        try {
            await contribute(account1, 1);
            fail("contribution should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
        }
    });

    it("should complete and record game with last contributor if pot goes over threshold", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        assert.equal(await contract.state(), completeState);
        await checkGame(account3, false, testThreshold, testThreshold);
    });

    it("should allow withdrawing contribution if time expires and new game begins", async () => {
        await contribute(account1, 2);
        await fastForward(threeHours);
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
            assert.equal(e.toString(), requireFailureMessage);
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

        await checkGame(account3, false, zero, testThreshold);
    });

    it("should not allow withdrawing winnings if you contributed to a game where you didn't win", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        try {
            await contract.withdrawWinnings({from: account1});
            fail("winnings withdrawal should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
            await checkGame(account3, false, testThreshold, testThreshold);
            await checkContribution(account1, twoEther, 0);
        }
    });

    it("should reset fields and record previous game if time expires and startNewGame is called", async () => {
        await contribute(account1, 2);
        const potStartTime = await contract.currentPotStartTime();
        await fastForward(threeHours);
        
        const transaction = await contract.startNewGame();
        const logs = transaction.logs;
        assert.equal(1, logs.length);

        const newPotStartTime = await contract.currentPotStartTime();
        const newPot = await contract.currentPot();

        const log = logs[0];
        assert.equal("NewGameStarted", log.event);
        assert.isTrue(newPotStartTime.equals(log.args.startTime));

        await checkGame("0x0000000000000000000000000000000000000000", true, zero, zero);
        assert.equal(await contract.state(), inProgressState);
        assert.isTrue(newPotStartTime.gte(potStartTime.plus(threeHours)));
        assert.isTrue(newPot.equals(zero));
    });

    it("should reset fields and not record game if previous game ended with winner and time expires", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        await fastForward(threeHours);
        await contract.startNewGame();

        await checkGame(account3, false, testThreshold, testThreshold);
        assert.equal(await contract.getNumberOfGames(), 1);
        assert.equal(await contract.state(), inProgressState);
    });

    it("should fail to startNewGame if time hasn't expired", async () => {
        await fastForward(oneHour);
        try {
            await contract.startNewGame();
            fail("startNewGame should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
            assert.equal(await contract.getNumberOfGames(), 0);
        }
    });

    it("should log sender, value, and time if ether is sent directly to contract", async () => {
        const transaction = await contract.sendTransaction({
            from: account1,
            value: web3.toWei(1, "ether")
        });

        const logs = transaction.logs;
        assert.equal(1, logs.length);

        const log = logs[0];
        assert.equal("Fallback", log.event);

        assert.equal(log.args.sender, account1);
        assert.isTrue(log.args.value.equals(oneEther));

        const potStartTime = await contract.currentPotStartTime();
        assert.isTrue(potStartTime.equals(log.args.time));
    })
});