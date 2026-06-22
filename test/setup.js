const dns = require("dns");

process.env.MONGO_URI = process.env.TEST_MONGO_URI;
dns.setServers(["8.8.8.8", "1.1.1.1"]);
