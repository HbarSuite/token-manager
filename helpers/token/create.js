import inquirer from 'inquirer';
import {
  Hbar,
  PrivateKey,
  PublicKey,
  TokenType,
  TokenSupplyType,
  TokenCreateTransaction,
  CustomFixedFee,
  CustomFractionalFee,
  CustomRoyaltyFee
} from '@hashgraph/sdk';
import Secrets from '../io/secrets.js';

class CreateToken {
  client = null;
  environment = null;
  secrets = null;

  constructor(client, environment) {
    this.client = client;
    this.environment = environment;
    this.secrets = new Secrets();
  }

  create(treasury) {
    return new Promise(async (resolve, reject) => {
      try {
        // genereting the keys we want to use in our token...
        let keys = await this.keys();

        // generating the token setup, asking for details...
        let settings = await this.tokenSettings();

        // generating the custom fees for our token...
        let fees = await this.customFees(settings.token_type, [], 10);

        // finally, we can create the blessed token...
        let tokenId = await this.createToken(treasury, keys, settings, fees);

        // writing the token object into the secrets.json file...
        let token = {
          environment: this.environment,
          id: tokenId.toString(),
          name: settings.token_name,
          symbol: settings.token_symbol,
          decimals: settings.token_decimals,
          type: settings.token_type.toString(),
          treasury: treasury,
          keys: keys
        };

        await this.secrets.writeSecrets(token);

        // and we resolve it...
        resolve(token);
      } catch (error) {
        reject(error);
      }
    });
  }

  createToken(treasury, keys, settings, fees) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await new TokenCreateTransaction()
          // setting the treasury account...  
          .setTreasuryAccountId(treasury.accountId)
          // setting all the details...
          .setTokenName(settings.token_name)
          .setTokenSymbol(settings.token_symbol)
          .setTokenMemo(settings.token_memo)
          .setTokenType(settings.token_type)
          .setDecimals(settings.token_decimals)
          .setSupplyType(settings.token_supply_type)
          .setInitialSupply(Number(settings.token_initialSupply * (10 ** settings.token_decimals)))
          .setMaxSupply(Number(settings.token_maxSupply * (10 ** settings.token_decimals)))
          .setFreezeDefault(settings.token_freeze_default);

        // setting all the keys...
        keys.forEach(key => {
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
        });

        // setting the custom fees...
        let customFees = [];

        fees.forEach(fee => {
          switch (fee.fee_type) {
            case 'fixed':
              let customFixedFee = new CustomFixedFee()
                .setAmount(fee.fixed_amount)
                .setDenominatingTokenId(fee.fixed_token)
                .setFeeCollectorAccountId(fee.fixed_collector);

              customFees.push(customFixedFee);
              break;
            case 'fractional':
              let customFractionalFee = new CustomFractionalFee()
                .setNumerator(fee.fractional_numerator)
                .setDenominator(fee.fractional_denominator)
                .setFeeCollectorAccountId(fee.fractional_collector);

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

        if (fees.length) {
          transaction.setCustomFees(customFees);
        }

        transaction.freezeWith(this.client);

        //If adminKey present, sign the transaction with the token adminKey and the token treasuryKey
        let adminKey = keys.find(key => key.type == 'Admin');
        if (adminKey) {
          const signTx = await (await transaction.sign(PrivateKey.fromString(adminKey.privateKey)))
            .sign(PrivateKey.fromString(treasury.privateKey));

          //Sign the transaction with the client operator private key and submit to a Hedera network
          const txResponse = await signTx.execute(this.client);

          //Get the receipt of the transaction
          const receipt = await txResponse.getReceipt(this.client);

          //Get the token ID from the receipt
          resolve(receipt.tokenId);
        } else {
          //If there is no adminKey, sign only with treasuryKey
          const signTx = await (await transaction.sign(PrivateKey.fromString(treasury.privateKey)))

          //Sign the transaction with the client operator private key and submit to a Hedera network
          const txResponse = await signTx.execute(this.client);

          //Get the receipt of the transaction
          const receipt = await txResponse.getReceipt(this.client);

          //Get the token ID from the receipt
          resolve(receipt.tokenId);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  customFees(tokenType, fees, limit) {
    return new Promise(async (resolve) => {
      let feesTypes = ['none', 'fixed', 'fractional'];

      if (tokenType == TokenType.NonFungibleUnique) {
        feesTypes.push('royalty');
      }

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
          type: 'input',
          name: 'token_name',
          message: "What's your token name"
        },
        {
          type: 'input',
          name: 'token_symbol',
          message: "What's your token's symbol?"
        },
        {
          type: 'input',
          name: 'token_memo',
          message: "What's your token's memo?"
        },
        {
          type: 'list',
          name: 'token_type',
          message: 'Will your token be Fungible or Not?',
          choices: [
            { name: TokenType.FungibleCommon.toString(), value: TokenType.FungibleCommon },
            { name: TokenType.NonFungibleUnique.toString(), value: TokenType.NonFungibleUnique }
          ]
        },
        {
          type: 'input',
          name: 'token_decimals',
          message: "How many decimals you wish to use?",
          default: 0,
          // TODO: validate this input as a number...
          validate(value) {
            return true;
          },
        },
        {
          type: 'input',
          name: 'token_initialSupply',
          message: "What's your token's initial supply?",
          default: 100000000000,
          when: (answers) => answers.token_type.toString() === TokenType.FungibleCommon.toString(),
          // TODO: validate this input as a number...
          validate(value) {
            return true;
          },
        },
        {
          type: 'list',
          name: 'token_supply_type',
          message: "Will your token's supply be finite or infinite?",
          choices: [
            { name: TokenSupplyType.Finite.toString(), value: TokenSupplyType.Finite },
            { name: TokenSupplyType.Infinite.toString(), value: TokenSupplyType.Infinite }
          ],
        },
        {
          type: 'input',
          name: 'token_maxSupply',
          message: "What's your token's max supply?",
          default: 100000000000,
          when: (answers) => answers.token_supply_type.toString() === TokenSupplyType.Finite.toString(),
          // TODO: validate this input as a number...
          validate(value) {
            return true;
          },
        },
        {
          type: 'confirm',
          name: 'token_freeze_default',
          message: "Will your token be frozen by default?",
          default: false
        }
      ];

      inquirer.prompt(questions).then((answers) => {
        resolve(answers);
      });
    });
  }

  keys() {
    return new Promise((resolve, reject) => {
      inquirer
        .prompt([
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
                name: 'Supply',
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
              {
                name: 'Pause',
                checked: true
              },
            ],
            validate(answer) {
              if (answer.length < 1) {
                return 'You must choose at least one key.';
              }

              return true;
            },
          },
        ])
        .then((answers) => {
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
        });
    });
  }
}

export default CreateToken