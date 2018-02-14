module.exports = {
    networks: {
        testrpc: {
            host: "localhost",
            port: 8565,
            network_id: "*"
        },
        coverage: {
            host: "localhost",
            port: 8555,
            network_id: "*",
            gas: 471238800000,
            gasPrice: 100000
        },
        rinkeby: {
            host:"localhost",
            port: 8545,
            from: "0xcae4c0b0a3f6bc2b9d1a8b1e77c510b89a606610",
            network_id: "4"
        }
    }
};