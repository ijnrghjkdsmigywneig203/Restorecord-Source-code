import BotClient from "./client/BotClient";
import { TOKEN, OWNERS } from "./Config";

import "./extenders/User";

new BotClient({ token: TOKEN, owners: OWNERS }).start();