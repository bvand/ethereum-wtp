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
        }
    }
};