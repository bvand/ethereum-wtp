# PoC React App - Rinkeby
This simple React app is used to test connection to the smart-contract deployed on the Rinkeby testnet.

This project was bootstrapped with [Create React App](https://github.com/facebookincubator/create-react-app).

### Testing on Rinkeby
1. Run geth (from parent folder): `geth --rpc --rinkeby --rpccorsdomain="*" --unlock 0`
2. Run app: `yarn run start`
Note that the address used here is my personal one and is password-protected - you'll have to create your own Rinkeby account and get Ether in order to play the game on the testnet (see https://faucet.rinkeby.io/)