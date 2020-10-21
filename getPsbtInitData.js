const axios = require('axios').default;
const Rpc = require('bitcoin-rpc-async');
const fs = require('fs');

// throttlep :: Number -> [(* -> Promise)]
const throttlep = n=> Ps=>
  new Promise ((pass, fail)=> {
    // r is the number of promises, xs is final resolved value
    let r = Ps.length, xs = []
    // decrement r, save the resolved value in position i, run the next promise
    let next = i=> x=> (r--, xs[i] = x, run(Ps[n], n++))
    // if r is 0, we can resolve the final value xs, otherwise chain next
    let run = (P,i)=> r === 0 ? pass(xs) : P && P().then(next(i), fail)
    // initialize by running the first n promises
    Ps.slice(0,n).forEach(run)
  });
const delay = (ms)=>
  new Promise (pass=> {
    setTimeout(pass, ms)
  });
function throttle (n, promises) {
    return throttlep(n)(promises);
}

const rawJson = fs.readFileSync('./data/endowment.json', {encoding: 'utf-8'});
const endowment = JSON.parse(rawJson);

const untestedWallets =  Object.entries(endowment)
    .filter(([_, v]) => v.cltv > 0)
    .map(([_, v]) => ({p2sh: v.p2sh, redeem: v.redeem_script, cltv: v.cltv}));

const seenKeys = {};
const dedupedWallets = untestedWallets.filter(x => {
    return seenKeys[x.p2sh] ? false : (seenKeys[x.p2sh] = true, true)
});

const rpc = new Rpc('http://user:password@localhost:8339', ['getBlockHash', 'getRawTransaction'], 'camelCase');

async function getRawTxFromBlockHeight (txid, height) {
    const h = await rpc.getBlockHash([height]);
    const r = await rpc.getRawTransaction([txid, false, h.result]);
    return r.result;
}

async function getNonempty() {
    const reqs = dedupedWallets.map(x => (async () => {
        const r = await axios.get(`https://explorer.bitcoingold.org/insight-api/addr/${x.p2sh}/utxo`);
        return {...x, utxos: r.data};
    }))

    const walletsWithUtxo = await throttle(10, reqs);
    const nonemtpyWallets = walletsWithUtxo.filter(x => x.utxos.length > 0);

    const jsonNonempty = JSON.stringify(nonemtpyWallets, undefined, 2);
    fs.writeFileSync('./data/nonempty.json', jsonNonempty, {encoding: 'utf-8'});
}

async function main () {
    const jsonNonempty = fs.readFileSync('./data/nonempty.json', {encoding: 'utf-8'});
    const nonemtpyWallets = JSON.parse(jsonNonempty);

    const txreqs = nonemtpyWallets
        .flatMap(x => x.utxos.map(u => ({...x, ...u, utxos: undefined})))
        .map((x, idx, arr) => (async () => {
            // const r = await axios.get(`https://explorer.bitcoingold.org/insight-api/rawtx/${x.txid}`);
            const rawtx = await getRawTxFromBlockHeight(x.txid, x.height);
            console.log(`${idx+1}/${arr.length}`)
            return {...x, rawtx};
        }));

    const utxos = await throttle(10, txreqs);

    const jsonUtxos = JSON.stringify(utxos, undefined, 2);
    fs.writeFileSync('./data/utxo.json', jsonUtxos, {encoding: 'utf-8'});    
}

main().catch(console.error).finally(() => process.exit());
