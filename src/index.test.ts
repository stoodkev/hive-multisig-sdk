import { Transaction, TransferOperation, VoteOperation } from '@hiveio/dhive';
import { describe, expect, it } from '@jest/globals';
import { HiveMultisigSDK } from '.';

describe('Test Get Username From Tx', () => {
  it('should return username from transfer operation', () => {
    const tx: Transaction = {
      ref_block_num: 1,
      ref_block_prefix: 2,
      expiration: new Date().toISOString(),
      extensions: [],
      operations: [
        [
          'transfer',
          {
            from: 'hi',
            to: 'ha',
            memo: '',
            amount: '',
          },
        ] as TransferOperation,
      ],
    };
    expect(HiveMultisigSDK.getUsernameFromTransaction(tx)).toBe('hi');
  });

  it('should return username from two operations', () => {
    const tx: Transaction = {
      ref_block_num: 1,
      ref_block_prefix: 2,
      expiration: new Date().toISOString(),
      extensions: [],
      operations: [
        [
          'transfer',
          {
            from: 'hi',
            to: 'ha',
            memo: '',
            amount: '',
          },
        ] as TransferOperation,
        [
          'vote',
          {
            voter: 'hi',
            permlink: 'ha',
            weight: 10,
            author: 'a',
          },
        ] as VoteOperation,
      ],
    };
    expect(HiveMultisigSDK.getUsernameFromTransaction(tx)).toBe('hi');
  });

  it('should return undefined when two operations have different usernames', () => {
    const tx: Transaction = {
      ref_block_num: 1,
      ref_block_prefix: 2,
      expiration: new Date().toISOString(),
      extensions: [],
      operations: [
        [
          'transfer',
          {
            from: 'hi',
            to: 'ha',
            memo: '',
            amount: '',
          },
        ] as TransferOperation,
        [
          'vote',
          {
            voter: 'ha',
            permlink: 'ha',
            weight: 10,
            author: 'a',
          },
        ] as VoteOperation,
      ],
    };
    expect(HiveMultisigSDK.getUsernameFromTransaction(tx)).toBe(undefined);
  });
});
