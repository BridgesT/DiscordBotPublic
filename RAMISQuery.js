const mysql2 = require("mysql2");
const config = require("./config.json");
let connection;
let results;


class RAMISQuery {
    constructor() {
        this.getConnection();
    }
    getConnection(){
        connection = mysql2.createConnection({
            host: config.mysqlConnection.hostName,
            user: config.mysqlConnection.userName,
            password: config.mysqlConnection.password,
            database: config.mysqlConnection.databaseName
        });
    }

    async doQuery(query) {
        return await new Promise((resolve) => {
            connection.query(query, (err, res) => {
                resolve(res)
            })
        }).then(res => {
            return res;
        })

    }
    closeConnection(){
        connection.end();
    }
    getResults(){
        return results;
    }
}
module.exports = RAMISQuery;
