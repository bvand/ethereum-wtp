pragma solidity ^0.4.17;

contract WinThePot {
  /*           Structs & Enums       */
  struct Contribution {
    uint value;
    uint gameIndex; 
  }

  struct Game {
    bool allCanWithdraw; // only set if time expired
    address winner;      // only set if someone won the game
    uint winnings;       // only set if someone won the game
    uint threshold;      // only set if someone won the game
  }

  enum State {
    inProgress,
    complete
  }

  /*           Events                */
  event Withdrawal(address to, bool success, uint value);

  /*           Constants             */
  uint constant public MAX_CONTRIBUTION = 4 ether;
  uint constant public MIN_CONTRIBUTION = 0.1 ether;
  uint constant public MAX_POT_THRESHOLD = 100; // 100 ether
  uint constant public MIN_POT_THRESHOLD = 1; // 1 ether
  uint constant public MAX_GAME_TIME = 2 hours;

  /*           Public Fields         */
  address public owner;
  uint public currentPotStartTime;
  uint public currentPot;
  Game[] public games;
  mapping(address => Contribution) public contributions;
  State public state;
  
  /*           Private Fields         */
  uint private threshold;

  /*           Modifiers             */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  modifier duringGame() {
    require(state == State.inProgress);
    _;
  }

  // Contribution must be within bounds
  // Only one contribution per address allowed at a time
  modifier contributionAllowed() {
    require(msg.value <= MAX_CONTRIBUTION && msg.value >= MIN_CONTRIBUTION);
    Contribution memory contribution = contributions[msg.sender];
    uint previousContribution = contribution.value;
    uint gameIndex = contribution.gameIndex;

    // allow contribution if
    // 1) you haven't contributed before or
    // 2) you contributed before and withdrew your contribution or
    // 3) you contributed before and lost or
    // 4) you contributed before and won and withdrew your winnings
    // (1) and (2) are true if previousContribution == 0
    // (3) is true if winner != msg.sender
    // (4) is true if winner == msg.sender && winnings == 0
    bool checkForLoss;
    address winner;
    uint winnings;
    if (gameIndex < games.length) {
      checkForLoss = true;
      Game storage game = games[gameIndex];
      winner = game.winner;
      winnings = game.winnings;
    }
    require(previousContribution == 0 || (checkForLoss && (winner != msg.sender || winnings == 0)));
    _;
  }

  modifier withdrawalPossible() {
    require(contributions[msg.sender].gameIndex < games.length);
    _;
  }

  modifier safeSender() {
    require(msg.sender != 0x00);
    _;
  }

  modifier timeLimitReached() {
    require(now > currentPotStartTime + MAX_GAME_TIME);
    _;
  }

  /*           Contract             */
  function WinThePot() public {
    owner = msg.sender;
    currentPotStartTime = now;
    state = State.inProgress;
    threshold = 10 ether; // TODO: use Oraclize and Random.org to generate random threshold
  }

  /*           Withdrawals          
   * Withdrawals are only allowed if 
   *   1) you won a game or 
   *   2) you participated in a game that expired before anyone won.
   * Adapted from http://solidity.readthedocs.io/en/develop/solidity-by-example.html Blind Auction
   */
  function withdrawContribution() public safeSender withdrawalPossible returns (bool) {
    Game storage game = games[contributions[msg.sender].gameIndex];
    require(game.allCanWithdraw);

    uint contribution = contributions[msg.sender].value;
    if (contribution > 0) {
      contributions[msg.sender].value = 0;

      // reset the contribution amount if sending fails
      if (!msg.sender.send(contribution)) {
        contributions[msg.sender].value = contribution;
        Withdrawal(msg.sender, false, contribution);
        return false;
      }
    }

    Withdrawal(msg.sender, true, contribution);
    return true;
  }

  
  function withdrawWinnings() public safeSender withdrawalPossible returns (bool) {
    Game storage game = games[contributions[msg.sender].gameIndex];
    require(msg.sender == game.winner);

    uint winnings = game.winnings;
    if (winnings > 0) {
      games[contributions[msg.sender].gameIndex].winnings = 0;

      // reset the game winnings if sending fails
      if (!msg.sender.send(winnings)) {
        games[contributions[msg.sender].gameIndex].winnings = winnings;
        return false;
      }
    }
    return true;
  }

  /*           Fallback (Contribution) Function             */
  function () public safeSender duringGame contributionAllowed payable {
    contributions[msg.sender] = Contribution(msg.value, games.length);
    currentPot = currentPot + msg.value;
    if (currentPot >= threshold) {
      state = State.complete;
      games.push(Game({
        allCanWithdraw: false,
        winner: msg.sender,
        winnings: currentPot,
        threshold: threshold
      }));
    }
  }

  /*           Start New Game
   * Opting to use Eager Evaluation
   * See https://ethereum.stackexchange.com/questions/42/how-can-a-contract-run-itself-at-a-later-time
   * Anyone can call startNewGame. This is so that responsibility is not on the owner to indefinitely start new games.
   * Starting a new game cannot end the previous game unless time has expired.
   */
  function startNewGame() public timeLimitReached returns (bool) {
    state = State.complete;
    currentPot = 0;
    currentPotStartTime = now;
    games.push(Game({
      allCanWithdraw: true,
      winner: address(0),
      winnings: 0,
      threshold: 0
    }));
    state = State.inProgress;
  }

  /*          Accessor Methods (for testing and/or UI)           */
  function getContribution(address addr) public view safeSender returns (uint value, uint gameIndex) {
    return (contributions[addr].value, contributions[addr].gameIndex);
  }

  function getGame(uint index) public view returns (bool allCanWithdraw, address winner, uint winnings, uint thresh) {
    Game storage game = games[index];
    return (game.allCanWithdraw, game.winner, game.winnings, game.threshold);
  }
}
