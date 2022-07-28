import { Application, Router, Request, Response } from "express";
import { AkairoClient } from "discord-akairo";
import { Repository } from "typeorm";
import { Token } from "../../models/Tokens";

import OAuth2 from "../../structures/OAuth2";
import { CALLBACK_URI, SCOPES, REDIRECT_URI } from "../../Config";

export default class OAuth2Router {
    protected app: Application;
    protected client: AkairoClient;
    protected router: Router;
    protected oauth: OAuth2; 
    protected tokenRepo: Repository<Token>;

    public constructor(app: Application, client: AkairoClient, oauth: OAuth2) {
        this.app = app;
        this.client = client;
        this.router = Router();
        this.oauth = oauth;
        this.tokenRepo = this.client.db.getRepository(Token);

        this.app.use(this.router);

        this.router.get("/oauth/login", (req: Request, res: Response) => {
            return res.status(302).redirect(`https://discord.com/oauth2/authorize?client_id=${this.client.user.id}&redirect_uri=${encodeURIComponent(CALLBACK_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}`);
        });

        this.router.get("/oauth/logout", (req: Request, res: Response) => {
            res.cookie("access_token", null, {
                maxAge: Date.now() - 3600
            });
            res.cookie("refresh_token", null, {
                maxAge: Date.now() - 3600
            });

            res.status(302).redirect(REDIRECT_URI);
        });

        this.router.get("/oauth/callback", async (req: Request, res: Response) => {
            const token = await this.oauth.exchange(req.query.code as string);

            res.cookie("access_token", token.access_token, { expires: new Date(Date.now() + Number(token.expires_in) * 1000) });
            res.cookie("refresh_token", token.refresh_token, { expires: new Date(Date.now() + 31556952000) });

            res.status(302).redirect(REDIRECT_URI);
        });

        this.router.get("/oauth/user", async (req: Request, res: Response) => {
            const user = await this.oauth.user(req.cookies.access_token, req.cookies.refresh_token, res)

            if (user) {
                const data: Token = await this.tokenRepo.findOne({ user: user.id });
                if (!data) {
                    await this.tokenRepo.insert({
                        user: user.id,
                        accessToken: req.cookies.access_token,
                        refreshToken: req.cookies.refresh_token
                    });
                } else {
                    if (data.accessToken !== req.cookies.access_token) {
                        data.accessToken = req.cookies.access_token;
                        data.refreshToken = req.cookies.refresh_token;
                        await this.tokenRepo.save(data);
                    }
                }
            }

            return res.status(200).json(user);
        });
    }
}