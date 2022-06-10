import inquirer from 'inquirer';
import {
  PrivateKey,
  PublicKey,
  TokenType,
  TokenUpdateTransaction,
  TokenFeeScheduleUpdateTransaction,
  CustomFractionalFee,
  CustomFixedFee,
  CustomRoyaltyFee,
  Hbar
} from '@hashgraph/sdk';
import Secrets from '../io/secrets.js';
import Account from '../../api/account.js';
import TokenAdministrate from './administrate.js';

class UpdateToken {
  client = null;
  environment = null;
  secrets = null;
  accountAPI = null;
  tokenAdministrate = null;

  constructor(client, environment) {
    this.client = client;
    this.environment = environment;
    this.accountAPI = new Account(this.client, this.environment);
    this.tokenAdministrate = new TokenAdministrate(this.client, this.environment);
    this.secrets = new Secrets();
  }

  updateSettings(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      try {
        // genereting the keys we want to use in our token...
        let keys = await this.keys();

        // generating the token setup, asking for details...
        let settings = await this.tokenSettings();

        // finally, we can update the blessed token...
        let response = await this.updateToken(tokenSecrets, keys, settings);

        if (response == 'SUCCESS') {
          if (settings.token_name_confirm) {
            tokenSecrets.name = settings.token_name;
          }

          if (settings.token_symbol_confirm) {
            tokenSecrets.symbol = settings.token_symbol;
          }

          if (settings.token_treasury_confirm) {
            tokenSecrets.treasury = settings.treasury;
          }

          keys.forEach(newKey => {
            let oldKey = tokenSecrets.keys.find(key => key.type == newKey.type);
            oldKey.privateKey = newKey.privateKey;
            oldKey.publicKey = newKey.publicKey;
          });

          await this.secrets.updateSecrets(tokenSecrets);
        }

        // and we resolve it...
        resolve(response);
      } catch (error) {
        reject(error);
      }
    });
  }

  updateFees(tokenSecrets) {
    return new Promise(async (resolve, reject) => {
      try {
        let fees = await this.customFees(tokenSecrets.type, [], 10);

        if (fees.length) {
          try {
            let customFees = [];

            fees.forEach(fee => {
              switch (fee.fee_type) {
                case 'fixed':
                  let customFixedFee = new CustomFixedFee()
                    .setHbarAmount(Hbar.fromString(fee.fixed_amount))
                    // .setAmount(fee.fixed_amount)
                    // .setDenominatingTokenId(fee.fixed_token)
                    .setFeeCollectorAccountId(fee.fixed_collector);

                  customFees.push(customFixedFee);
                  break;
                case 'fractional':
                  let customFractionalFee = new CustomFractionalFee()
                    .setNumerator(fee.fractional_numerator)
                    .setDenominator(fee.fractional_denominator)
                    .setFeeCollectorAccountId(fee.fractional_collector)
                    .setAssessmentMethod(true);

                  customFees.push(customFractionalFee);
                  break;
                case 'royalty':
                  let customRoyaltyFee = new CustomRoyaltyFee()
                    .setNumerator(fee.royalty_numerator)
                    .setDenominator(fee.royalty_denominator)
                    .setFeeCollectorAccountId(fee.royalty_collector)
                    .setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(fee.royalty_fallback)));

                  customFees.push(customRoyaltyFee);
                  break;
              }
            });

            const transaction = await new TokenFeeScheduleUpdateTransaction()
              .setTokenId(tokenSecrets.id);
            console.log("updating fees");
            transaction.setCustomFees([]); // customFees

            transaction.freezeWith(this.client);

            const fee = tokenSecrets.keys.find(key => key.type == 'Fees Schedule');
            const signTx = await transaction.sign(PrivateKey.fromString(fee.privateKey));

            const txResponse = await signTx.execute(this.client);
            const receipt = await txResponse.getReceipt(this.client);
            resolve(receipt.status.toString());
          } catch (error) {
            reject(error);
          }
        } else {
          resolve("No fees to update");
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  updateToken(tokenSecrets, keys, settings) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await new TokenUpdateTransaction()
          .setTokenId(tokenSecrets.id);

        if (settings.token_treasury_confirm) {
          // associating the new treasury with the token...
          await this.tokenAdministrate.associate(tokenSecrets, settings.treasury.accountId, settings.treasury.privateKey);
          // then we can set the new treasury acount on updateToken transaction...
          transaction.setTreasuryAccountId(settings.treasury.accountId);
        }

        if (settings.token_name_confirm) {
          transaction.setTokenName(settings.token_name);
        }

        if (settings.token_symbol_confirm) {
          transaction.setTokenSymbol(settings.token_symbol);
        }

        if (settings.token_memo_confirm) {
          transaction.setTokenMemo(settings.token_memo);
        }

        // setting all the new keys, if any...
        keys.forEach(key => {
          try {
            switch (key.type) {
              case 'Admin':
                transaction.setAdminKey(PublicKey.fromString(key.publicKey));
                break;
              case 'KYC':
                transaction.setKycKey(PublicKey.fromString(key.publicKey));
                break;
              case 'Freeze':
                transaction.setFreezeKey(PublicKey.fromString(key.publicKey));
                break;
              case 'Wipe':
                transaction.setWipeKey(PublicKey.fromString(key.publicKey));
                break;
              case 'Supply':
                transaction.setSupplyKey(PublicKey.fromString(key.publicKey));
                break;
              case 'Fees Schedule':
                transaction.setFeeScheduleKey(PublicKey.fromString(key.publicKey));
                break;
              case 'Pause':
                transaction.setPauseKey(PublicKey.fromString(key.publicKey));
                break;
            }
          } catch (error) {
            console.log(error.message);
          }
        });

        // freezing with client...
        transaction.freezeWith(this.client);
        // signing with the main admin key...
        const admin = tokenSecrets.keys.find(key => key.type == 'Admin');
        let signTx = await transaction.sign(PrivateKey.fromString(admin.privateKey));
        // signing with the new admin key, if any...
        const newAdmin = keys.find(key => key.type == 'Admin');
        if (newAdmin) {
          signTx = await signTx.sign(PrivateKey.fromString(newAdmin.privateKey));
        }
        // signing with the new treasury key, if any...
        if (settings.token_treasury_confirm) {
          signTx = await signTx.sign(PrivateKey.fromString(settings.treasury.privateKey));
        }
        // finally, executing the transaction...
        const txResponse = await signTx.execute(this.client);
        const receipt = await txResponse.getReceipt(this.client);

        resolve(receipt.status.toString());
      } catch (error) {
        reject(error);
      }
    });
  }

  customFees(tokenType, fees, limit) {
    return new Promise(async (resolve) => {
      let feesTypes = ['none', 'fixed', 'fractional', 'royalty'];

      //if (tokenType == TokenType.NonFungibleUnique) {
      //feesTypes.push('royalty');
      //}

      inquirer.prompt([
        {
          type: 'list',
          name: 'fee_type',
          message: 'What kind of custom fee you want to add?',
          choices: feesTypes
        },
        // fixed fee...
        {
          type: 'input',
          name: 'fixed_amount',
          message: "What's the amount?",
          when: (answers) => answers.fee_type === 'fixed',
        },
        {
          type: 'input',
          name: 'fixed_token',
          message: "What's the token id?",
          when: (answers) => answers.fee_type === 'fixed',
        },
        {
          type: 'input',
          name: 'fixed_collector',
          message: "What's the collector?",
          when: (answers) => answers.fee_type === 'fixed',
        },
        // fractional fee...
        {
          type: 'input',
          name: 'fractional_numerator',
          message: "What's the numerator?",
          when: (answers) => answers.fee_type === 'fractional',
        },
        {
          type: 'input',
          name: 'fractional_denominator',
          message: "What's the denominator?",
          when: (answers) => answers.fee_type === 'fractional',
        },
        {
          type: 'input',
          name: 'fractional_collector',
          message: "What's the collector?",
          when: (answers) => answers.fee_type === 'fractional',
        },
        // royalty fee...
        {
          type: 'input',
          name: 'royalty_numerator',
          message: "What's the numerator?",
          when: (answers) => answers.fee_type === 'royalty',
        },
        {
          type: 'input',
          name: 'royalty_denominator',
          message: "What's the denominator?",
          when: (answers) => answers.fee_type === 'royalty',
        },
        {
          type: 'input',
          name: 'royalty_collector',
          message: "What's the collector?",
          when: (answers) => answers.fee_type === 'royalty',
        },
        {
          type: 'input',
          name: 'royalty_fallback',
          message: "What's the hbar fallback amount?",
          when: (answers) => answers.fee_type === 'royalty',
        },
        {
          type: 'confirm',
          name: 'quit',
          message: 'are you sure you?',
          when: (answers) => answers.fee_type === 'none',
          default: true,
        },
        {
          type: 'confirm',
          name: 'askAgain',
          message: 'Want to create another custom fee?',
          when: (answers) => (answers.quit === false) && (fees.length < limit),
          default: true,
        },
      ]
      ).then(async (fee) => {
        fees.push(fee);

        if ((fee.askAgain || !fee.quit) && fees.length < limit) {
          fees = await this.customFees(tokenType, fees, limit);
          resolve(fees);
        } else {
          resolve(fees);
        }
      });
    });
  }

  tokenSettings() {
    return new Promise(async (resolve, reject) => {
      const questions = [
        {
          type: 'confirm',
          name: 'token_name_confirm',
          message: "Want to change your token's name?",
          default: false
        },
        {
          type: 'input',
          name: 'token_name',
          message: "What's your new token's name?",
          when: (answers) => answers.token_name_confirm === true,
        },
        {
          type: 'confirm',
          name: 'token_symbol_confirm',
          message: "Want to change your token's symbol?",
          default: false
        },
        {
          type: 'input',
          name: 'token_symbol',
          message: "What's your new token's symbol?",
          when: (answers) => answers.token_symbol_confirm === true,
        },
        {
          type: 'confirm',
          name: 'token_memo_confirm',
          message: "Want to change your token's memo?",
          default: false
        },
        {
          type: 'input',
          name: 'token_memo',
          message: "What's your new token's memo?",
          when: (answers) => answers.token_memo_confirm === true,
        },
        {
          type: 'confirm',
          name: 'token_treasury_confirm',
          message: "Want to change your token's treasury?",
          default: false
        }
      ];

      inquirer.prompt(questions).then(async (answers) => {
        let treasury = null;

        if (answers.token_treasury_confirm) {
          treasury = await this.accountAPI.create();
        }

        resolve({ ...answers, treasury });
      });
    });
  }

  keys() {
    return new Promise((resolve, reject) => {
      inquirer
        .prompt([
          {
            type: 'confirm',
            name: 'keys_confirm',
            message: "Want to change your token's keys?",
            default: false
          },
          {
            type: 'checkbox',
            message: 'Select the keys you want to generate',
            name: 'keys',
            choices: [
              new inquirer.Separator(' = The Keys = '),
              {
                name: 'Admin',
                checked: true
              },
              {
                name: 'KYC',
                checked: true
              },
              {
                name: 'Freeze',
                checked: true
              },
              {
                name: 'Wipe',
                checked: true
              },
              {
                name: 'Fees Schedule',
                checked: true
              },
              // {
              //   name: 'Pause',
              //   checked: true
              // },
              // {
              //   name: 'Supply',
              //   checked: true
              // },              
            ],
            when: (answers) => answers.keys_confirm === true,
            validate(answer) {
              if (answer.length < 1) {
                return 'You must choose at least one key.';
              }

              return true;
            },
          },
        ])
        .then((answers) => {
          if (answers.keys_confirm) {
            let keys = [];

            answers.keys.forEach(async (type) => {
              // Create new account keys...
              const privateKey = await PrivateKey.generate();
              keys.push({
                type: type,
                privateKey: privateKey.toString(),
                publicKey: privateKey.publicKey.toString(),
              })
            });

            resolve(keys);
          } else {
            resolve([]);
          }
        });
    });
  }
}

export default UpdateToken