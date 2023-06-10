import { Client } from '@hiveio/dhive';

let hiveClient: Client;

const getClient = () => {
  if (!hiveClient)
    hiveClient = new Client([
      'https://api.hive.blog',
      'https://api.hivekings.com',
      'https://anyx.io',
      'https://api.openhive.network',
    ]);
  return hiveClient;
};
const getAccount = async (username: string) => {
  var client = getClient();
  return client.database.getAccounts([username]);
};

export const HiveUtils = {
  getClient,
  getAccount,
};
