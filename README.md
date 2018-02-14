# ethereum-wtp
Win the Pot is an Ethereum-based smart contract that gives players the opportunity to win a pot of Ether. The rules are simple:
1. Send Ether to the contract address
2. If your contribution puts the value of the pot at or above a certain threshold (randomly generated each game), then you win the pot

## Additional details:
* **The threshold is a random integer between 1 and 100**
* If the pot threshold hasn't been reached by the end of the game time limit (2 hours), then your Ether becomes available for withdrawal
* You may only contribute to one game at a time

## Technical details
* The random threshold is generated using Oraclize (http://www.oraclize.it/) 

## Development
* yarn 1.3.2
* npm 5.6.0
* node 8.9.4
* install dependencies: `yarn`
* test: `yarn run test`

### Migrate Contracts to testrpc
* `yarn run compile`
* `yarn run testrpc` (must get run before `migrate`)
* `yarn run migrate`

### Code Coverage
* `yarn run coverage-testrpc` (must get run before `coverage`)
* `yarn run coverage`