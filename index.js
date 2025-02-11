const express = require('express');
const axios = require('axios');
const fs = require('fs');
const yaml = require('js-yaml');
const cryton = require('crypto');
const app = express();

const config = getConfig();
const key = config.gateway.key;
const algorithm = 'AES/CBC/PKCS5Padding';

let lastTimeStamp = 0;

app.get('/', function (req, res) {
    res.send('DingZhen Refresh Token.');
});

app.get('/gateway/token', function (req, res) {
    if(!isCorrectSecret(req.get('X-Gateway-Secret'))){
        res.send('secret is not correct');
    }
    var account = getAccount();
    res.send(doAuth({username: account['username'], password: account['password'], hwid: account['hwid']}));
})

app.get('/gateway/heartbeat', function (req, res) {
    if(!isCorrectSecret(req.get('X-Gateway-Secret'))){
        res.send('secret is not correct', 403);
    }
    res.json({'time': new Date().getTime(), 'coldDown':{'time': lastTimeStamp}, 'implementation': 'zszfympx/DingZhenRefreshToken(TypeScript)'});
})
const Status ={
    CLOUDFLARE:'CLOUDFLARE',
    BANNED: 'BANNED',
    INCORRECT: 'INCORRECT',
    OK: 'OK',
    SERVLET_ERROR: 'SERVLET_ERROR',
    NO_ACCOUNT: 'NO_ACCOUNT'
}

async function doAuth(vapeAccount) {
    if(lastTimeStamp+config.colddown<new Date().getTime()){
        return {token: '', status:Status.NO_ACCOUNT};
    }
    lastTimeStamp = new Date().getTime();
    try {
        const response = await axios.post(
            'http://www.vape.gg/auth.php',
            `email=${vapeAccount.username}&password=${vapeAccount.password}&hwid=${vapeAccount.hwid}&v=v3&t=true`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': `Agent_${vapeAccount.hwid}`
                }
            }
        );

        const responseString = response.data;

        if (response.status === 200 && responseString) {
            if (responseString.length !== 33) {
                switch (responseString) {
                    case '1006':
                        console.error(`Your IP address was banned by Manthe. Please switch your VPN endpoint or use a Gateway. (${responseString})`);
                        return { token: 'Cloudflare', status: Status.CLOUDFLARE };
                    case '102':
                        console.error(`Vape account ${vapeAccount.username} was banned. (${responseString})`);
                        return { token: 'Disabled', status: Status.BANNED };
                    default:
                        console.error(`Auth server responded an error: ${responseString} (Account: ${vapeAccount.username})`);
                        return { token: 'Null', status: Status.INCORRECT };
                }
            }
            console.debug(`Fetch token for ${vapeAccount.username} (${responseString})`);
            return { token: encrypt(responseString, key) , status: Status.OK };
        } else {
            return { token: 'Empty auth data', status: Status.SERVLET_ERROR };
        }
    } catch (error) {
        return { token: '', status: Status.SERVLET_ERROR };
    }
}

function getAccount() {
    fs.readFile('account.csv', 'utf8', (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          return;
        }

        const rows = data.split('\n');
        const headers = rows[0].split(',');

        var account = rows.slice(1).map(row => {
            const values = row.split(',');
            return headers.reduce((obj, header, index) => {
            obj[header] = values[index];
            return obj;
            }, {});
        })[0];

        return {
            username: account['username'],
            password: account['password'],
            hwid: account['hwid']
        }
    });
}

function isCorrectSecret(GatewaySecret){
    return decrypt(GatewaySecret, key)==='Hello World'
}

function decrypt(ciphertext, key) {
    const iv = getIV();
    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function encrypt(plainText, key){
    const iv = getIV();
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let crypted = cipher.update(plainText, 'base64', 'utf8');
    crypted += cipher.final('utf8');
    return crypted;
}

function getIV() {
    const keyBuffer = Buffer.from(key, 'base64');
    const iv = Buffer.alloc(16);
    keyBuffer.copy(iv, 0, 0, 16);
    return iv;
}

function getConfig() {
    const yamlContent = fs.readFileSync('config.yml', 'utf8');
    return yaml.load(yamlContent);
}

app.listen(config.port, ()=>{
    console.log("DingZhenRefreshToken is running!");
})