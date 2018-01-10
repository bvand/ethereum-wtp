var Migrations = artifacts.require("./WinThePot.sol");

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
