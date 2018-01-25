module.exports = {
    networks: {
        development: {
            host: "localhost",
            port: 8545,
            network_id: "*" // Match any network id
        },
        coverage: {
            host: "localhost",
            port: 8555,
            network_id: "*",
            gas: 471238800000,
            gasPrice: 100000
        }
    }
};
// 47123880000000000
// 471238800000000000000
// 100000000000000000000