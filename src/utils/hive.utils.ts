import {
  AccountsByKey,
  Client,
  PublicKey,
  SignedTransaction,
} from '@hiveio/dhive';
import { KeychainKeyTypes } from 'hive-keychain-commons';
import { Authorities } from '../interfaces/signer';

let hiveClient: Client;

const getClient = () => {
  if (!hiveClient)
    hiveClient = new Client([
      'https://api.hive.blog',
      'https://api.hivekings.com',
      'https://api.deathwing.me',
      'https://anyx.io',
      'https://api.openhive.network',
    ]);
  return hiveClient;
};
const getAccount = async (username: string) => {
  var client = getClient();
  return (await client.database.getAccounts([username]))[0];
};
const getAccountAuthorities = async (username: string) => {
  const account = await getAccount(username);
  if (!account) {
    return undefined;
  }
  const keys: Authorities = {
    account: account.name,
    owner: account.owner,
    active: account.active,
    posting: account.posting,
    memo_key: account.memo_key,
    json_metadata: account.json_metadata,
  };
  return keys;
};

const getThreshold = async (username: string, keyType: KeychainKeyTypes) => {
  const authorities = await getAccountAuthorities(username);
  if (authorities) {
    switch (keyType) {
      case KeychainKeyTypes.active:
        return authorities?.active.weight_threshold;
      case KeychainKeyTypes.posting:
        return authorities?.posting.weight_threshold;
    }
  }
  return undefined;
};

const getKeyReferences = async (publicKey: string) => {
  var client = getClient();
  const reference: AccountsByKey = await client.keys.getKeyReferences([
    publicKey,
  ]);
  return reference.accounts[0][0];
};

const getAuthorityWeightOverUser = async (
  authority: string | PublicKey,
  username: string,
  keyType: KeychainKeyTypes,
) => {
  const authorities = await getAccountAuthorities(username);
  if (authorities) {
    switch (keyType) {
      case KeychainKeyTypes.active:
        if (authority.toString().startsWith('STM')) {
          for (const [u, w] of authorities.active.key_auths) {
            if (authority === u) {
              return w;
            }
          }
        } else {
          for (const [u, w] of authorities.active.account_auths) {
            if (authority === u) {
              return w;
            }
          }
        }

      case KeychainKeyTypes.posting:
        if (authority.toString().startsWith('STM')) {
          for (const [u, w] of authorities.posting.key_auths) {
            if (authority === u) {
              return w;
            }
          }
        } else {
          for (const [u, w] of authorities.posting.account_auths) {
            if (authority === u) {
              return w;
            }
          }
        }
    }
  }
  return undefined;
};

export const getPublicKeys = async (
  username: string,
  keyType: KeychainKeyTypes,
) => {
  const authorities = await getAccount(username);
  if (authorities) {
    switch (keyType) {
      case KeychainKeyTypes.active:
        return authorities.active.key_auths.map((key) => {
          return key[0];
        });
      case KeychainKeyTypes.posting:
        return authorities.posting.key_auths.map((key) => {
          return key[0];
        });
      default:
        return undefined;
    }
  }
  return undefined;
};

const broadcastTx = async (transaction: SignedTransaction) => {
  var client = getClient();
  var res = await client.broadcast.send(transaction);
  return res;
};

const getPublicKey = async (username: string, keyType: KeychainKeyTypes) => {
  var account = await getAccount(username);
  try {
    switch (keyType) {
      case KeychainKeyTypes.posting:
        return account.posting.key_auths[0][0];
      case KeychainKeyTypes.active:
        return account.active.key_auths[0][0];
    }
  } catch {
    throw Error(`Cannot find public key for ${username}`);
  }
};
const get2FABots = async (username: string, method: KeychainKeyTypes) => {
  const authorities = await getAccountAuthorities(username);
  let bots: [string, number][] = [];
  const authority =
    method === KeychainKeyTypes.active
      ? authorities?.active
      : authorities?.posting;
  if (!authority) {
    return bots;
  }

  for (let i = 0; i < authority.account_auths.length; i++) {
    const auth = authority.account_auths[i];
    const account = await HiveUtils.getAccount(auth[0]);
    const jsonMetadata = JSON.parse(account['json_metadata']);
    const isMultisigBot = jsonMetadata?.isMultisigBot === true;
    if (isMultisigBot) {
      bots = bots.concat([auth]);
    }
  }
  return bots;
  // const results = await Promise.all(
  //   potentialSigners.map(async (signer) => {
  //     if (signer[0].includes('STM')) return null;
  //     const account = await HiveUtils.getAccount(signer[0]);
  //     console.log(JSON.stringify(account));
  //     const jsonMetadata = JSON.parse(account[0]['json_metadata']);
  //     const isMultisigBot = jsonMetadata?.isMultisigBot === true;
  //     return isMultisigBot ? signer : null;
  //   }),
  // );

  // return results.filter((result) => result !== null);
};
const getPotentialSigners = async (
  username: string,
  method: KeychainKeyTypes,
) => {
  const authorities = await getAccountAuthorities(username);
  const authority =
    method === KeychainKeyTypes.active
      ? authorities?.active
      : authorities?.posting;
  let receivers: [string, number][] = [];
  if (authority) {
    for (let i = 0; i < authority.account_auths.length; i++) {
      const pk = await getPublicKeys(authority.account_auths[i][0], method);
      if (pk) {
        for (let k = 0; k < pk.length; k++) {
          receivers.push([pk[k].toString(), authority.account_auths[i][1]]);
        }
      }
    }
    for (let k = 0; k < authority.key_auths.length; k++) {
      receivers.push([
        authority.key_auths[k][0].toString(),
        authority.key_auths[k][1],
      ]);
    }
  }

  return receivers;
};
export const HiveUtils = {
  getClient,
  getAccount,
  getPublicKey,
  getPublicKeys,
  getPotentialSigners,
  broadcastTx,
  getAccountAuthorities,
  getThreshold,
  getAuthorityWeightOverUser,
  get2FABots,
  getKeyReferences,
};
