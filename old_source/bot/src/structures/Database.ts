import { ConnectionManager } from "typeorm";

import { Settings } from "../models/Settings";
import { RestoreUser } from "../models/User";
import { Token } from "../models/Tokens";
import { DATABASE_NAME } from "../Config";

const connectionManager = new ConnectionManager();

connectionManager.create({
    name: DATABASE_NAME,
    type: "sqlite",
    database: "./db.sqlite",
    entities: [
        Settings,
        RestoreUser,
        Token
    ]
});

export default connectionManager;