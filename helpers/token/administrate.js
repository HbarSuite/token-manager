import inquirer from 'inquirer';
import {
  Hbar,
  AccountId,
  PrivateKey,
  TransferTransaction,
  TokenMintTransaction,
  TokenBurnTransaction,
  TokenWipeTransaction,
  TokenPauseTransaction,
  TokenDeleteTransaction,
  TokenFreezeTransaction,
  TokenUnpauseTransaction,
  TokenUnfreezeTransaction,
  TokenGrantKycTransaction,
  TokenRevokeKycTransaction,
  TokenAssociateTransaction,
  TokenDissociateTransaction
} from '@hashgraph/sdk';
import axios from 'axios';
import Secrets from '../../helpers/io/secrets.js';

class AdministrateToken {
  client = null;
  environment = null;
  secrets = null;

  constructor(client, environment) {
    this.client = client;
    this.environment = environment;
    this.secrets = new Secrets();
  }

  hbarTransfer(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'transfer_to',
          message: "Insert the wallet ID of the receiver"
        },
        {
          type: 'input',
          name: 'transfer_amount',
          message: "Insert the amount you want to transfer"
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TransferTransaction()
            .addHbarTransfer(
              tokenSecrets.treasury.accountId,
              new Hbar(-answers.transfer_amount)
            )
            .addHbarTransfer(
              answers.transfer_to, 
              new Hbar(answers.transfer_amount)
            )
            .setTransactionMemo('safeIcoTransfer Bot')
            .freezeWith(this.client);

          const signTx = await transaction.sign(PrivateKey.fromString(
            tokenSecrets.treasury.privateKey
          ));
          const txResponse = await signTx.execute(this.client);

          const receipt = await txResponse.getReceipt(this.client);
          resolve(receipt.status.toString());
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  withdraw(tokenSecrets, withdraw_from, withdraw_key, withdraw_amount) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'withdraw_from',
          message: "Insert the wallet ID to withdraw from",
          default: withdraw_from
        },
        {
          type: 'input',
          name: 'withdraw_key',
          message: "Insert the wallet Key to withdraw from",
          default: withdraw_key
        },        
        {
          type: 'input',
          name: 'withdraw_amount',
          message: "Insert the amount you want to withdraw",
          default: withdraw_amount
        },
        {
          type: 'input',
          name: 'withdraw_to',
          message: "Insert the destination wallet",
          default: tokenSecrets.treasury.accountId
        }        
      ]).then(async (answers) => {
        try {
          const transaction = await new TransferTransaction()
            .addTokenTransfer(
              tokenSecrets.id,
              answers.withdraw_from,
              Number(-answers.withdraw_amount  * (10 ** tokenSecrets.decimals))
            )
            .addTokenTransfer(
              tokenSecrets.id, 
              answers.withdraw_to,
              Number(answers.withdraw_amount  * (10 ** tokenSecrets.decimals))
            )
            .freezeWith(this.client);

          const signTx = await transaction.sign(PrivateKey.fromString(answers.withdraw_key));
          const txResponse = await signTx.execute(this.client);

          const receipt = await txResponse.getReceipt(this.client);
          resolve(receipt.status.toString());
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  transfer(tokenSecrets, transfer_to, transfer_amount) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'transfer_to',
          message: "Insert the wallet ID of the receiver",
          default: transfer_to
        },
        {
          type: 'input',
          name: 'transfer_amount',
          message: "Insert the amount you want to transfer",
          default: transfer_amount
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TransferTransaction()
            .addTokenTransfer(
              tokenSecrets.id, 
              tokenSecrets.treasury.accountId, 
              Number(-answers.transfer_amount  * (10 ** tokenSecrets.decimals))
            )
            .addTokenTransfer(
              tokenSecrets.id, 
              answers.transfer_to, 
              Number(answers.transfer_amount  * (10 ** tokenSecrets.decimals))
            )
            .freezeWith(this.client);

          const signTx = await transaction.sign(PrivateKey.fromString(tokenSecrets.treasury.privateKey));
          const txResponse = await signTx.execute(this.client);

          const receipt = await txResponse.getReceipt(this.client);
          resolve(receipt.status.toString());
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  nftTransfer(tokenSecrets, transfer_to, transfer_amount) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'transfer_to',
          message: "Insert the wallet ID of the receiver",
          default: transfer_to
        },
        {
          type: 'input',
          name: 'transfer_amount',
          message: "Insert the amount you want to transfer",
          default: transfer_amount
        }
      ]).then(async (answers) => {
          try {
            const transaction = await new TransferTransaction()
              .addNftTransfer(
                AccountId.fromString(tokenSecrets.id.toString()),
                1,
                AccountId.fromString(tokenSecrets.treasury.accountId),
                answers.transfer_to
              )
              .freezeWith(this.client);
            const signTx = await transaction.sign(PrivateKey.fromString(tokenSecrets.treasury.privateKey.toString()));
            const txResponse = await signTx.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);
            resolve(receipt.status.toString());
          } catch(error) {
            reject(new Error(`error while transfering NFT:  ${error.message}`));
          }
      });
    });
  }

  delete(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'confirm',
          name: 'delete',
          message: "are you sure you want to delete this token?"
        }
      ]).then(async (answers) => {
        if (answers.delete) {
          try {
            const transaction = await new TokenDeleteTransaction()
              .setTokenId(tokenSecrets.id)
              .freezeWith(this.client);

            const admin = tokenSecrets.keys.find(key => key.type == 'Admin');
            const signTx = await transaction.sign(PrivateKey.fromString(admin.privateKey));
            const txResponse = await signTx.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);

            if (receipt.status.toString() == 'SUCCESS') {
              await this.secrets.deleteSecrets(tokenSecrets.id);
            }

            resolve(receipt.status.toString());

          } catch (error) {
            reject(error);
          }
        } else {
          resolve(`Ok, will not delete ${tokenSecrets.name} token.`);
        }
      });
    });
  }

  mint(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'mint_amount',
          message: `How many ${tokenSecrets.symbol} you want to mint?`
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenMintTransaction()
            .setTokenId(tokenSecrets.id)
            .setAmount(Number(answers.mint_amount * (10 ** tokenSecrets.decimals)))
            .freezeWith(this.client);

          const supply = tokenSecrets.keys.find(key => key.type == 'Supply');
          const signTx = await transaction.sign(PrivateKey.fromString(supply.privateKey));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  burn(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'burn_amount',
          message: `How many ${tokenSecrets.symbol} you want to burn?`
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenBurnTransaction()
            .setTokenId(tokenSecrets.id)
            .setAmount(Number(answers.burn_amount * (10 ** tokenSecrets.decimals)))
            .freezeWith(this.client);

          const supply = tokenSecrets.keys.find(key => key.type == 'Supply');
          const signTx = await transaction.sign(PrivateKey.fromString(supply.privateKey));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  freeze(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'freeze_account',
          message: `Which is the accountId you want to freeze?`
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenFreezeTransaction()
            .setAccountId(answers.freeze_account)
            .setTokenId(tokenSecrets.id)
            .freezeWith(this.client);

          const freeze = tokenSecrets.keys.find(key => key.type == 'Freeze');
          const signTx = await transaction.sign(PrivateKey.fromString(freeze.privateKey));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  unfreeze(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'freeze_account',
          message: `Which is the accountId you want to freeze?`
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenUnfreezeTransaction()
            .setAccountId(answers.freeze_account)
            .setTokenId(tokenSecrets.id)
            .freezeWith(this.client);

          const freeze = tokenSecrets.keys.find(key => key.type == 'Freeze');
          const signTx = await transaction.sign(PrivateKey.fromString(freeze.privateKey));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  enableKyc(tokenSecrets, kyc_account) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'kyc_account',
          message: `Which is the accountId you want to enable KYC for?`,
          default: kyc_account
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenGrantKycTransaction()
            .setAccountId(answers.kyc_account)
            .setTokenId(tokenSecrets.id)
            .freezeWith(this.client);

          const kyc = tokenSecrets.keys.find(key => key.type == 'KYC');
          const signTx = await transaction.sign(PrivateKey.fromString(kyc.privateKey));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  disableKyc(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'kyc_account',
          message: `Which is the accountId you want to disable KYC for?`
        }
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenRevokeKycTransaction()
            .setAccountId(answers.kyc_account)
            .setTokenId(tokenSecrets.id)
            .freezeWith(this.client);

          const kyc = tokenSecrets.keys.find(key => key.type == 'KYC');
          const signTx = await transaction.sign(PrivateKey.fromString(kyc.privateKey));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  associate(tokenSecrets, associate_account, associate_key) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'associate_account',
          message: `Which is the accountId you want associate with ${tokenSecrets.symbol}?`,
          default: associate_account,
        },
        {
          type: 'input',
          name: 'associate_key',
          message: `Which is the privateKey of the account?`,
          default: associate_key,
        }        
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenAssociateTransaction()
            .setAccountId(answers.associate_account)
            .setTokenIds([tokenSecrets.id])
            .freezeWith(this.client);

          const signTx = await transaction.sign(PrivateKey.fromString(answers.associate_key));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  disassociate(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'associate_account',
          message: `Which is the accountId you want disassociate with ${tokenSecrets.symbol}?`
        },
        {
          type: 'input',
          name: 'associate_key',
          message: `Which is the privateKey of the account?`
        }        
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenDissociateTransaction()
            .setAccountId(answers.associate_account)
            .setTokenIds([tokenSecrets.id])
            .freezeWith(this.client);

          const signTx = await transaction.sign(PrivateKey.fromString(answers.associate_key));
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  pause(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'confirm',
          name: 'pause',
          message: `Are you sure you want to pause ${tokenSecrets.symbol}?`
        }      
      ]).then(async (answers) => {
        try {
          if(answers.pause) {
            const transaction = await new TokenPauseTransaction()
            .setTokenId(tokenSecrets.id)
            .freezeWith(this.client);

          const pause = tokenSecrets.keys.find(key => key.type == 'Pause');
          const signTx = await transaction.sign(PrivateKey.fromString(pause.privateKey));            
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());
          } else {
            resolve("Ok, won't pause it.");
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  unpause(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'confirm',
          name: 'unpause',
          message: `Are you sure you want to unpause ${tokenSecrets.symbol}?`
        }      
      ]).then(async (answers) => {
        try {
          if(answers.unpause) {
            const transaction = await new TokenUnpauseTransaction()
            .setTokenId(tokenSecrets.id)
            .freezeWith(this.client);

          const pause = tokenSecrets.keys.find(key => key.type == 'Pause');
          const signTx = await transaction.sign(PrivateKey.fromString(pause.privateKey));            
          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());
          } else {
            resolve("Ok, won't unpause it.");
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  wipe(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([
        {
          type: 'input',
          name: 'wipe_account',
          message: `Which is the accountId you want wipe off ${tokenSecrets.symbol}?`
        },
        {
          type: 'input',
          name: 'wipe_key',
          message: `Which is the privateKey of the account?`
        },
        {
          type: 'input',
          name: 'wipe_amount',
          message: `How many ${tokenSecrets.symbol} you want to wipe off?`
        }           
      ]).then(async (answers) => {
        try {
          const transaction = await new TokenWipeTransaction()
            .setAccountId(answers.wipe_account)
            .setTokenId(tokenSecrets.id)
            .setAmount(Number(answers.wipe_amount * (10 ** tokenSecrets.decimals)))
            .freezeWith(this.client);

          const wipe = tokenSecrets.keys.find(key => key.type == 'Wipe');
          const signTx = await (await transaction.sign(PrivateKey.fromString(answers.wipe_key)))
            .sign(PrivateKey.fromString(wipe.privateKey));

          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

  swap(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      inquirer.prompt([     
        {
          type: 'input',
          name: 'swap_account',
          message: `Which is the accountID you want to swap with?`
        },
        {
          type: 'input',
          name: 'swap_key',
          message: `Which is the private key of the account?`
        },        
        {
          type: 'input',
          name: 'swap_amount',
          message: `How many HBAR you want to swap?`
        },  
        {
          type: 'input',
          name: 'swap_ratio',
          message: `Which is the ratio between HBAR / ${tokenSecrets.symbol}?`
        }              
      ]).then(async (answers) => {
        try {
          const transaction = await new TransferTransaction()
            .addHbarTransfer(
              answers.swap_account, 
              new Hbar(-answers.swap_amount)
            )      
            .addHbarTransfer(
              tokenSecrets.treasury.accountId,
              new Hbar(answers.swap_amount)
            )
            .addTokenTransfer(
              tokenSecrets.id,
              tokenSecrets.treasury.accountId, 
              Number(-(answers.swap_amount * answers.swap_ratio) * (10 ** tokenSecrets.decimals))
            )
            .addTokenTransfer(
              tokenSecrets.id,
              answers.swap_account,
              Number((answers.swap_amount * answers.swap_ratio) * (10 ** tokenSecrets.decimals))
            )
            .freezeWith(this.client);

          const signTx = await (await transaction.sign(PrivateKey.fromString(answers.swap_key)))
            .sign(PrivateKey.fromString(tokenSecrets.treasury.privateKey));

          const txResponse = await signTx.execute(this.client);
          const receipt = await txResponse.getReceipt(this.client);

          resolve(receipt.status.toString());

        } catch (error) {
          reject(error);
        }
      });
    });
  }

}

export default AdministrateToken