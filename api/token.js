import inquirer from 'inquirer';
import CreateToken from '../helpers/token/create.js';
import UpdateToken from '../helpers/token/update.js';
import AdministrateToken from '../helpers/token/administrate.js';
import Secrets from '../helpers/io/secrets.js';

class Token {
  client = null;
  environment = null;
  createToken = null;
  administrateToken = null;
  secrets = null;

  constructor(client, environment) {
    this.client = client;
    this.environment = environment;
    this.createToken = new CreateToken(client, environment);
    this.updateToken = new UpdateToken(client, environment);
    this.administrateToken = new AdministrateToken(client, environment);
    this.secrets = new Secrets();
  }

  create(treasury) {
    return new Promise(async (resolve, reject) => {
      try {
        let token = await this.createToken.create(treasury);
        resolve(token);
      } catch (error) {
        reject(error);
      }
    });
  }

  update() {
    return new Promise(async (resolve, reject) => {
      try {
        // reading secrets from file...
        let secrets = await this.secrets.readSecrets();
        // mapping the tokens into a data struct, 
        // filtered by selected environment...
        let tokens = secrets.filter(
          secret => secret.environment == this.environment
        );

        if (tokens.length) {
          // asking to choose a token beween the available ones...
          inquirer.prompt([
            {
              type: 'list',
              name: 'token_id',
              message: 'Which token do you want to update?',
              choices: tokens.map(token => {
                return {
                  name: `${token.name} (${token.symbol} - ${token.id})`,
                  value: token.id
                }
              }),
            },
            {
              type: 'list',
              name: 'update_action',
              message: 'What do you want to update?',
              choices: ['token settings', 'token fees'],
            }                       
          ]).then(async (answers) => {
            let tokenSecrets = secrets.find(secret => secret.id == answers.token_id);
            
            try {
              let response = null;

              switch(answers.update_action) {
                case 'token settings':
                  response = await this.updateToken.updateSettings(tokenSecrets);
                  break;
                case 'token fees':
                  response = await this.updateToken.updateFees(tokenSecrets);
                  break;                  
              }

              resolve(response);
               
            } catch(error) {
              reject(error);
            }
          });
        } else {
          resolve("Sorry, no tokens available in the secrets file for the choosen environment.");
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  administrate() {
    return new Promise(async (resolve, reject) => {
      try {
        // reading secrets from file...
        let secrets = await this.secrets.readSecrets();
        // mapping the tokens into a data struct, 
        // filtered by selected environment...
        let tokens = secrets.filter(
          secret => secret.environment == this.environment
        );

        if (tokens.length) {
          // asking to choose a token beween the available ones...
          inquirer.prompt(
            {
              type: 'list',
              name: 'id',
              message: 'Which token do you want to administrate?',
              choices: tokens.map(token => {
                return {
                  name: `${token.name} (${token.symbol} - ${token.id})`,
                  value: token.id
                }
              }),
            }
          ).then(async (token) => {
            let tokenSecrets = secrets.find(secret => secret.id == token.id);

            let actions = [
              {name: 'Transfer HBAR (transfers HBAR from treasury into a given wallet)', value: 'transfer_hbar'},
              {name: 'Transfer Token (transfers the token from treasury into a given wallet)', value: 'transfer'},
              {name: 'Transfer NFT (transfers the NFT from treasury into a given wallet)', value: 'nftTransfer'},
              {name: 'Withdraw Token (transfers the token from any account you own into a given wallet)', value: 'withdraw'},
              {name: 'Delete Token', value: 'delete'},
              {name: 'Mint a Token', value: 'mint'},
              {name: 'Burn Token', value: 'burn'},
              {name: 'Freeze an Account', value: 'freeze'},
              {name: 'Unfreeze an Account', value: 'unfreeze'},
              {name: 'Enable KYC Account Flag', value: 'enable_kyc'},
              {name: 'Disable KYC Account Flag', value: 'disable_kyc'},
              {name: 'Associate Token to Account', value: 'associate'},
              {name: 'Disassociate Token to Account', value: 'disassociate'},
              {name: 'Pause a Token', value: 'pause'},
              {name: 'Unpause a Token', value: 'unpause'},
              {name: 'Wipe a Token', value: 'wipe'},
              {name: 'Swap a Token (get HBAR from a wallet to own and send tokens back from treasury)', value: 'swap'}
            ];
            
            inquirer.prompt(
              {
                type: 'list',
                name: 'action',
                message: `Which action do you want to execute on ${tokenSecrets.name}?`,
                choices: actions
              }
            ).then(async(answer) => {
              try {
                let response = null;

                switch(answer.action) {
                  case 'transfer_hbar':
                    response = await this.administrateToken.hbarTransfer(tokenSecrets);
                    break;                  
                  case 'transfer':
                    response = await this.administrateToken.transfer(tokenSecrets);
                    break;
                  case 'nftTransfer':
                    response = await this.administrateToken.nftTransfer(tokenSecrets);
                    break;
                  case 'withdraw':
                    response = await this.administrateToken.withdraw(tokenSecrets);
                    break;                    
                  case 'delete':
                    response = await this.administrateToken.delete(tokenSecrets);
                    break;
                  case 'mint':
                    response = await this.administrateToken.mint(tokenSecrets);
                    break;
                  case 'burn':
                    response = await this.administrateToken.burn(tokenSecrets);
                    break;
                  case 'freeze':
                    response = await this.administrateToken.freeze(tokenSecrets);
                    break;
                  case 'unfreeze':
                    response = await this.administrateToken.unfreeze(tokenSecrets);
                    break;    
                  case 'enable_kyc':
                    response = await this.administrateToken.enableKyc(tokenSecrets);
                    break;
                  case 'disable_kyc':
                    response = await this.administrateToken.disableKyc(tokenSecrets);
                    break;
                  case 'associate':
                    response = await this.administrateToken.associate(tokenSecrets);
                    break;
                  case 'disassociate':
                    response = await this.administrateToken.disassociate(tokenSecrets);
                    break;
                  case 'pause':
                    response = await this.administrateToken.pause(tokenSecrets);
                    break;
                  case 'unpause':
                    response = await this.administrateToken.unpause(tokenSecrets);
                    break;          
                  case 'wipe':
                    response = await this.administrateToken.wipe(tokenSecrets);
                    break;
                  case 'swap':
                    response = await this.administrateToken.swap(tokenSecrets);
                    break;                                                               
                }
  
                resolve({action: answer.action, response: response});                
              } catch(error) {
                reject(error);
              }
            });            
          });
        } else {
          resolve("Sorry, no tokens available in the secrets file for the choosen environment.");
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default Token