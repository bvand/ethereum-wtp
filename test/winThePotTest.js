const WinThePot = artifacts.require("WinThePot");
const BigNumber = require('bignumber.js');

contract("WinThePot", (accounts) => {
    let contract;
    let contribute;
    let checkContribution;
    let checkGame;
    let fastForward;

    const oneEther = new BigNumber('1e18');

    const ether = (value) => {
        return oneEther.mul(value);
    }

    const twoEther = ether(2);
    const testThreshold = ether(10); // this will change once Oraclize is used
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
                value: ether(etherValue)
            });
        };

        checkContribution = async (account, expectedValue, expectedGameIndex, expectedContributionCounter, expectedWithdrawn) => {
            const contribution = await contract.getContribution(account);
            const value = contribution[0];
            const gameIndex = contribution[1];
            const contributionCounter = contribution[2]; 
            const withdrawn = contribution[3];

            assert.isTrue(value.equals(expectedValue), `expected value to equal ${expectedValue} but was ${value}`);
            assert.isTrue(gameIndex.equals(expectedGameIndex), `expected index to equal ${expectedGameIndex} but was ${gameIndex}`);
            assert.isTrue(contributionCounter.equals(expectedContributionCounter), `expected contrib counter to equal ${expectedContributionCounter} but was ${contributionCounter}`);
            assert.equal(withdrawn, expectedWithdrawn, `expected withdrawn to equal ${expectedWithdrawn} but was ${withdrawn}`);
        }

        checkGame = async (expectedWinner, expectedAllCanWithdraw, expectedPotValue, expectedThreshold, expectedWinningIndex, expectedWithdrawn) => {
            const game = await contract.getGame(0);
            assert.equal(game[0], expectedAllCanWithdraw, "allCanWithdraw didn't match expected");
            assert.equal(game[1], expectedWinner, "winner didn't match expected");
            assert.isTrue(expectedPotValue.equals(game[2]), `expected pot value to equal ${expectedPotValue} but was ${game[2]}`);
            assert.isTrue(expectedThreshold.equals(game[3]), `expected threshold to equal ${testThreshold} but was ${game[3]}`);
            assert.isTrue(expectedWinningIndex.equals(game[4]), `expected winning index to equal ${expectedWinningIndex} but was ${game[4]}`);
            assert.equal(game[5], expectedWithdrawn, "winningsWithdrawn didn't match expected");
        }

        fastForward = async (time) => {
            await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [time], id: new Date().getTime()});
            await web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: new Date().getTime()});
        }
    });

    /*                           Constructor Tests                           */
    it("should initialize contract with expected owner and time", async () => {
        assert.equal(await contract.owner(), owner);
        assert.equal(await contract.currentPotStartTime(), web3.eth.getBlock(web3.eth.blockNumber).timestamp);
    });

    /*                Contribution Tests              */
    it("should allow single contribution", async () => {
        const potPreSend = await contract.currentPot();
        assert.isTrue(potPreSend.equals(zero));

        await contribute(account1, 1);
        await checkContribution(account1, oneEther, 0, 0, false);

        const potPostSend = await contract.currentPot();
        assert.isTrue(potPostSend.equals(oneEther));

        assert.equal(await contract.contributionCounter(), 1);
        assert.equal(await contract.thresholdOwners(0), account1);

        assert.equal(await contract.getNumThresholdsOwned(), 1);
    });

    it("should allow multiple contributions from different addresses in the same game", async () => {
        await contribute(account1, 2);
        await checkContribution(account1, twoEther, 0, 0, false);
        await contribute(account2, 2);
        await checkContribution(account2, twoEther, 0, 1, false);

        const potPostSend = await contract.currentPot();
        assert.isTrue(potPostSend.equals(ether(4)));

        assert.equal(await contract.contributionCounter(), 2);
        assert.equal(await contract.thresholdOwners(0), account1);
        assert.equal(await contract.thresholdOwners(1), account1);
        assert.equal(await contract.thresholdOwners(2), account2);
        assert.equal(await contract.thresholdOwners(3), account2);
        assert.equal(await contract.getNumThresholdsOwned(), 4);
    });

    it("should allow you to contribute to another game if you lose earlier game", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);
        assert.equal(await contract.getNumThresholdsOwned(), 10);        

        await fastForward(threeHours);
        await contract.startNewGame();
        
        await contribute(account1, 1);
        await checkContribution(account1, oneEther, 1, 0, false);

        const secondGamePot = await contract.currentPot();
        assert.isTrue(secondGamePot.equals(oneEther));
    
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

    /*                                             New Game Tests                                                             */
    it("should complete and record game with expected winner if pot is over threshold and startNewGame is called", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        await fastForward(threeHours);
        await contract.startNewGame();

        await checkGame(account3, false, testThreshold, testThreshold, new BigNumber(2), false);
        assert.equal(await contract.getNumberOfGames(), 1);
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
        const newNumThresholdsOwned = await contract.getNumThresholdsOwned();

        const log = logs[0];
        assert.equal("NewGameStarted", log.event);
        assert.isTrue(newPotStartTime.equals(log.args.startTime));

        await checkGame("0x0000000000000000000000000000000000000000", true, twoEther, testThreshold, zero, false);
        assert.isTrue(newPotStartTime.gte(potStartTime.plus(threeHours)));
        assert.isTrue(newPot.equals(zero));
        assert.equal(newNumThresholdsOwned, 0);

        assert.equal(await contract.getNumberOfGames(), 1);
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

    /*                                        Withdrawal Tests                                                 */
    it("should allow withdrawing contribution if pot value is below threshold and new game begins", async () => {
        await contribute(account1, 2);
        await fastForward(threeHours);
        await contract.startNewGame();

        const transaction = await contract.withdrawContributionExpiredGame({from: account1});
        const logs = transaction.logs;
        assert.equal(1, logs.length);

        const log = logs[0];
        assert.equal("ExpiredContributionWithdrawal", log.event);
        assert.equal(account1, log.args.to);
        assert.isTrue(log.args.success);
        assert.isTrue(log.args.value.equals(twoEther));
        checkContribution(account1, twoEther, 0, 0, true);
    });

    it("should not allow withdrawing contribution before time expires", async () => {
        await contribute(account1, 2);
        try {
            await contract.withdrawContributionExpiredGame({from: account1});
            fail("contribution withdrawal should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
            await checkContribution(account1, twoEther, 0, 0, false);
        }
    });

    it("should allow withdrawing winnings if you won", async () => {
        await contribute(account1, 4);
        await contribute(account2, 4);
        await contribute(account3, 4);
        const expectedPot = ether(12);

        await fastForward(threeHours);
        await contract.startNewGame();

        const transaction = await contract.withdrawWinnings({from: account3});
        const logs = transaction.logs;
        assert.equal(1, logs.length);

        const log = logs[0];
        assert.equal("WinningsWithdrawal", log.event);
        assert.equal(account3, log.args.to);
        assert.isTrue(log.args.success);
        assert.isTrue(log.args.value.equals(expectedPot));

        await checkGame(account3, false, expectedPot, testThreshold, new BigNumber(2), true);
    });

    it("should not allow withdrawing winnings if you contributed to a game where you didn't win", async () => {
        await contribute(account1, 2);
        await contribute(account2, 4);
        await contribute(account3, 4);

        await fastForward(threeHours);
        await contract.startNewGame();

        try {
            await contract.withdrawWinnings({from: account1});
            fail("winnings withdrawal should fail");
        } catch (e) {
            assert.equal(e.toString(), requireFailureMessage);
            await checkGame(account3, false, testThreshold, testThreshold, new BigNumber(2), false);
            await checkContribution(account1, twoEther, 0, 0, false);
        }
    });

    /*                               Fallback Function Test                                   */
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
    });
});