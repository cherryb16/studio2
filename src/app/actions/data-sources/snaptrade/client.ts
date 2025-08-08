// src/app/actions/data-sources/snaptrade/client.ts

import { Snaptrade } from "snaptrade-typescript-sdk";

export const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID || '',
  consumerKey: process.env.SNAPTRADE_SECRET || '',
});