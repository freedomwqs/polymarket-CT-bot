import { ethers } from 'ethers';
import Safe from '@safe-global/safe-core-sdk';
import { EthersAdapter } from '@safe-global/safe-ethers-adapters';

export async function execSafeCall(signer: ethers.Signer, safeAddress: string, to: string, data: string) {
  const ethAdapter = new EthersAdapter({ ethers, signer });
  const safe = await Safe.create({ ethAdapter, safeAddress });
  const safeTransaction = await safe.createTransaction({ safeTransactionData: { to, data, value: '0' } });
  const exec = await safe.executeTransaction(safeTransaction);
  await exec.transactionResponse?.wait();
}
