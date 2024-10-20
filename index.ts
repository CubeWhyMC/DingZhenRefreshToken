const express = require('express');
const axios = require('axios');
const app = express();

app.get('/', function (req, res) {
    res.send('DingZhen Refresh Token.');
});

app.get('/gateway/token', function (req, res) {
    res.send(doAuth({username:'zszf', password:'a', hwid:'awa', id:'0'}));
})

interface VapeAccount {
    username: string;
    password: string;
    hwid: string;
    id: string;
}

interface VapeAuthorizeDTO {
    token: string;
    status: Status;
}

enum Status {
    CLOUDFLARE = 'CLOUDFLARE',
    BANNED = 'BANNED',
    INCORRECT = 'INCORRECT',
    OK = 'OK',
    SERVLET_ERROR = 'SERVLET_ERROR'
}

async function doAuth(vapeAccount: VapeAccount): Promise<VapeAuthorizeDTO> {
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
                        return { token: responseString, status: Status.INCORRECT };
                }
            }

            console.debug(`Fetch token for ${vapeAccount.username} (${responseString})`);
            return { token: responseString, status: Status.OK };
        } else {
            return { token: 'Empty auth data', status: Status.SERVLET_ERROR };
        }
    } catch (error) {
        return { token: (error as Error).message, status: Status.SERVLET_ERROR };
    }
}