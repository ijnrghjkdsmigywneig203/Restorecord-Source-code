import express, { Application } from "express";
import { AkairoClient } from "discord-akairo";
import { createServer } from "https";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import cors from "cors";
import { readFileSync } from "fs";
import { join } from "path";

import { API_PORT, API_IP, REDIRECT_URI } from "../Config";
import AdminRouter from "./routes/AdminRouter";
import ServerRouter from "./routes/ServerRouter";
import RestoreRouter from "./routes/RestoreRouter";
import OAuth2Router from "./routes/OAuth2Router";
import OAuth2 from "../structures/OAuth2";

export default class RestAPI {
    private client: AkairoClient;
    protected server: Application;
    protected oauth: OAuth2;

    public constructor(client: AkairoClient) {
        this.client = client;
        this.oauth = new OAuth2(this.client);
        this.client.oauth = this.oauth;
    }

    public start() {
        this.server = express();
        this.server.use(express.json());
        this.server.use(cookieParser());
        this.server.use(bodyParser.json());
        this.server.use(cors({
            origin: REDIRECT_URI,
            optionsSuccessStatus: 200,
            credentials: true
        }));

        this.server.disable("x-powered-by");
        this.server.set("trust-proxy", 1);

        new AdminRouter(this.server, this.client, this.oauth);
        new ServerRouter(this.server, this.client, this.oauth);
        new RestoreRouter(this.server, this.client, this.oauth);
        new OAuth2Router(this.server, this.client, this.oauth);

        //createServer(this.server).listen(API_PORT, API_IP, (): void => this.client.logger.init(`API is now online on Port: ${API_PORT}`));

        createServer({
            key: readFileSync(join(__dirname, "..", "..", "ssl", "private.key")),
            cert: readFileSync(join(__dirname, "..", "..", "ssl", "cert.crt")),
            ca: readFileSync(join(__dirname, "..", "..", "ssl", "ca.ca_bundle"))
        }, this.server).listen(API_PORT, API_IP, (): void => this.client.logger.init(`API is now online on Port: ${API_PORT}`));
    }
}