require('dotenv').config()
const Rpc = require('bitcoin-rpc-async');
const fs = require('fs');

const rawJson = fs.readFileSync('./data/final-txes.json', {encoding: 'utf-8'});
const finalTxes = JSON.parse(rawJson);
const rpcUri = process.env['RPC'] || 'http://user:password@localhost:8339';

const rpc = new Rpc(rpcUri, ['sendRawTransaction', 'getBlockchainInfo'], 'camelCase');

async function main () {
    console.log(await rpc.getBlockchainInfo());
    const results = [];
    for (const tx of finalTxes) {
        const r = await rpc.sendRawTransaction([tx]);
        results.push(r);
    }

    const jsonResults = JSON.stringify(results, undefined, 2);
    fs.writeFileSync('./data/broadcast-results.json', jsonResults, {encoding: 'utf-8'});
}

main().catch(console.error).finally(() => process.exit());
