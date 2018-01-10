# ethereum-wtp
Win the Pot is an Ethereum-based smart contract that gives players the opportunity to win a pot of Ether. The rules are simple:
1. Send Ether to the contract address
2. If your contribution puts the value of the pot at or above a certain threshold (randomly generated each day), then you win the pot

## Additional details:
* If the pot threshold hasn't been reached by the end of the 24 hour period, then your Ether is returned to you
* **The threshold is a random integer between 1 and 100**

## Technical details
* The random threshold is generated using a combination of Oraclize (http://www.oraclize.it/) and the Random.org JSON-RPC API (https://api.random.org/json-rpc/1/)
