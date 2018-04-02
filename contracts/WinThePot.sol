pragma solidity ^0.4.17;

import "./usingOraclize.sol";

contract WinThePot is usingOraclize {
  /*           Structs & Enums       */
  struct Contribution {
    uint value;             // ether value of the contribution
    uint gameIndex;         // which game the contribution was a part of
    uint contributionIndex; // order of this contribution (i.e. 2nd, 4th... 0-indexed)
    bool withdrawn;         // true if contributor has withdrawn their funds
    uint potPostContrib;    // value of the pot post this contribution (used to help determine winnings)
  }

  struct Game {
    bool allCanWithdraw;    // true if time expired
    address winner;         // set to winner's address (if winner exists)
    uint potValue;          // set to value of pot
    uint threshold;         // set to game threshold
    uint winningIndex;      // set to the winner's contribution index if someone won the game
    bool winningsWithdrawn; // only true if someone won the game and then withdrew their winnings
  }

  /*           Events                */
  event ExpiredContributionWithdrawal(address to, bool success, uint value);
  event AboveThresholdContributionWithdrawal(address to, bool success, uint value);
  event WinningsWithdrawal(address to, bool success, uint value);
  event StartNewGame(address from, bytes32 queryId);
  event NewGameStarted(uint startTime);
  event Fallback(address sender, uint value, uint time);

  /*           Constants             */
  uint constant public MAX_CONTRIBUTION = 4 ether;
  uint constant public MIN_CONTRIBUTION = 0.1 ether;
  uint constant public MAX_POT_THRESHOLD = 100; // 100 ether
  uint constant public MIN_POT_THRESHOLD = 1; // 1 ether  
  uint constant public MAX_POT_VALUE = 104 ether; // allow pot to reach up to 104 ether (exclusive) on final contribution
  uint constant public MAX_GAME_TIME = 2 hours;
  uint constant public RAND_BYTES = 7;

  /*           Public Fields         */
  address public owner;
  uint public currentPotStartTime;
  uint public currentPot;
  Game[] public games;
  mapping(address => Contribution) public contributions;
  uint public contributionCounter;
  address[] public thresholdOwners; // gives which contributor address wins when the threshold (1-100) is revealed

  // Contribution must be within bounds
  // Only one contribution per address allowed at a time
  modifier contributionAllowed() {
    require(msg.value <= MAX_CONTRIBUTION && msg.value >= MIN_CONTRIBUTION);
    require(currentPot + msg.value < MAX_POT_VALUE);
    Contribution memory contribution = contributions[msg.sender];
    uint previousContribution = contribution.value;
    uint gameIndex = contribution.gameIndex;
    bool contributionWithdrawn = contribution.withdrawn;

    // allow contribution if
    // 1) you haven't contributed before or
    // 2) you contributed before and withdrew your contribution or
    // 3) you contributed before and lost or
    // 4) you contributed before and won and withdrew your winnings
    // (1) is true if previousContribution == 0
    // (2) is true if (1) is false AND withdrawn is true
    // (3) is true if (1) and (2) are false AND winner != msg.sender
    // (4) is true if the rest are false AND winner == msg.sender AND winningsWithdrawn is true
    bool checkForLoss;
    address winner;
    bool winningsWithdrawn;
    if (gameIndex < games.length) {
      checkForLoss = true;
      Game storage game = games[gameIndex];
      winner = game.winner;
      winningsWithdrawn = game.winningsWithdrawn;
    }
    require(previousContribution == 0 || contributionWithdrawn || (checkForLoss && (winner != msg.sender || winningsWithdrawn)));
    _;
  }

  modifier contributed() {
    require(contributions[msg.sender].gameIndex < games.length);
    _;
  }

  modifier timeLimitReached() {
    require(now > currentPotStartTime + MAX_GAME_TIME);
    _;
  }

  /*           Contract             */
  function WinThePot() public {
    // necessary for testing using ethereum-bridge
    OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
    owner = msg.sender;
    currentPotStartTime = now;
    oraclize_setProof(proofType_Ledger);
  }

  /*           Withdrawals          
   * Withdrawals are only allowed if 
   *   1) you won a game or 
   *   2) you contributed above the threshold in a game that had a winner or
   *   3) you participated in a game that expired before anyone won.
   * Adapted from http://solidity.readthedocs.io/en/develop/solidity-by-example.html Blind Auction
   */
  function withdrawWinnings() external contributed returns (bool) {
    Game storage game = games[contributions[msg.sender].gameIndex];
    require(msg.sender == game.winner);
    require(!game.winningsWithdrawn);

    uint winnings = game.potValue;
    assert(winnings > 0);

    // reset the withdrawal if sending fails
    games[contributions[msg.sender].gameIndex].winningsWithdrawn = true;
    if (!msg.sender.send(winnings)) {
      games[contributions[msg.sender].gameIndex].winningsWithdrawn = false;
      WinningsWithdrawal(msg.sender, false, winnings);
      return false;
    }

    WinningsWithdrawal(msg.sender, true, winnings);    
    return true;
  }

  function withdrawContributionAboveThreshold() external contributed returns (bool) {
    Contribution storage contribution = contributions[msg.sender];
    Game storage game = games[contribution.gameIndex];
    require(contribution.contributionIndex > game.winningIndex);
    require(!contribution.withdrawn);

    uint contributionValue = contribution.value;
    assert(contributionValue > 0);

    // reset the withdrawal if sending fails
    contributions[msg.sender].withdrawn = true;
    if (!msg.sender.send(contributionValue)) {
      contributions[msg.sender].withdrawn = false;
      AboveThresholdContributionWithdrawal(msg.sender, false, contributionValue);
      return false;
    }

    AboveThresholdContributionWithdrawal(msg.sender, true, contributionValue);    
    return true;
  }

  function withdrawContributionExpiredGame() external contributed returns (bool) {
    Contribution storage contribution = contributions[msg.sender];
    Game storage game = games[contribution.gameIndex];
    require(game.allCanWithdraw);    
    require(!contribution.withdrawn);

    uint contributionValue = contribution.value;
    assert(contributionValue > 0);

    // reset the withdrawal if sending fails
    contributions[msg.sender].withdrawn = true;
    if (!msg.sender.send(contributionValue)) {
      contributions[msg.sender].withdrawn = false;
      ExpiredContributionWithdrawal(msg.sender, false, contributionValue);
      return false;
    }

    ExpiredContributionWithdrawal(msg.sender, true, contributionValue);    
    return true;
  }

  /*           Contribution             */
  function contribute() external contributionAllowed payable {
    assert(thresholdOwners.length < MAX_POT_THRESHOLD);
    
    currentPot = currentPot + msg.value;
    contributions[msg.sender] = Contribution(msg.value, games.length, contributionCounter, false, currentPot);
    contributionCounter++;
    uint nextThreshold = (thresholdOwners.length + 1) * 1 ether;

    while (nextThreshold <= currentPot) {
      thresholdOwners.push(msg.sender);
      nextThreshold += 1 ether;
    }
  }

  /*           Start New Game
   * Opting to use Eager Evaluation
   * See https://ethereum.stackexchange.com/questions/42/how-can-a-contract-run-itself-at-a-later-time
   * Anyone can call startNewGame. This is so that responsibility is not on the owner indefinitely to start new games.
   * Starting a new game cannot end the previous game unless time has expired.
   */
  function startNewGame() external timeLimitReached {
    updateThreshold();
  }

  // Oraclize callback method. Receives the random threshold from Oraclize and ends the game.
  function __callback(bytes32 _queryId, string _result, bytes _proof) external {
    require(msg.sender == oraclize_cbAddress());
    require(oraclize_randomDS_proofVerify__returnCode(_queryId, _result, _proof) == 0);

    uint thresholdIndex = uint(keccak256(_result)) % MAX_POT_THRESHOLD;

    uint thresholdValue = thresholdIndex * 1 ether;
    if (currentPot >= thresholdValue) {
      address gameWinner = thresholdOwners[thresholdIndex - 1];
      games.push(Game({
        allCanWithdraw: false,
        winner: gameWinner,
        potValue: contributions[gameWinner].potPostContrib,
        threshold: thresholdValue,
        winningIndex: contributions[gameWinner].contributionIndex,
        winningsWithdrawn: false
      }));
    } else {
      games.push(Game({
        allCanWithdraw: true,
        winner: address(0),
        potValue: currentPot,
        threshold: thresholdValue,
        winningIndex: 0,
        winningsWithdrawn: false
      }));
    }

    currentPot = 0;
    currentPotStartTime = now;
    contributionCounter = 0;
    thresholdOwners = new address[](0);
    NewGameStarted(currentPotStartTime);
  }

  function updateThreshold() private {
    uint delay = 0;
    uint callbackGas = 2000000;
    bytes32 queryId = oraclize_newRandomDSQuery(delay, RAND_BYTES, callbackGas);
    StartNewGame(msg.sender, queryId);
  }

  /*           Fallback Function             */
  function () public payable {
    Fallback(msg.sender, msg.value, now);
  }

  /*          Accessor Methods (for testing and UI)           */
  function getContribution(address addr) public view returns (uint value, uint gameIndex, uint contributionIndex, bool withdrawn, uint potPostContrib) {
    Contribution storage contribution = contributions[addr];
    return (contribution.value, contribution.gameIndex, contribution.contributionIndex, contribution.withdrawn, contribution.potPostContrib);
  }

  function getGame(uint index) public view returns (bool allCanWithdraw, address winner, uint winnings, uint thresh, uint winningIndex, bool withdrawn) {
    Game storage game = games[index];
    return (game.allCanWithdraw, game.winner, game.potValue, game.threshold, game.winningIndex, game.winningsWithdrawn);
  }

  function getNumberOfGames() public view returns (uint length) {
    return games.length;
  }

  function getNumThresholdsOwned() public view returns (uint length) {
    return thresholdOwners.length;
  }
}