import { Client } from '@hiveio/dhive';
import { KeychainKeyTypes } from 'hive-keychain-commons';

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

const getPublicKey = async(username:string, keyType: KeychainKeyTypes) =>{
  var account = await getAccount(username);
  try{
    switch(keyType){
      case KeychainKeyTypes.posting:
         return account[0].posting.key_auths[0]
      case KeychainKeyTypes.active:
         return account[0].active.key_auths[0]
     }
  }catch{
    throw  Error(`Cannot find public key for ${username}`);
  }
 
}

export const HiveUtils = {
  getClient,
  getAccount,
  getPublicKey
};
