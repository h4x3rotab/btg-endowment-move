require('dotenv').config()
const bgold = require('bgoldjs-lib');
const fs = require('fs');

const network = bgold.networks.bitcoingold;

// keys
const WIFs = process.env.KEYS.split(',');
const keys = WIFs.map(wif => bgold.ECPair.fromWIF(wif, network));

// inputs
const jsonUtxo = fs.readFileSync('./data/utxo.json');
const utxo = JSON.parse(jsonUtxo);

// consts
const TARGET = 'AZC9QwCx3sB5n6STccPg9owpprwo1q4qh5';
const INPUTS = 100;
const FEE = 100000; // 54k, ~1.8sat/byte
const LOCK_TIME = 656540;
const SIGHASH_TYPE =  bgold.Transaction.SIGHASH_ALL | bgold.Transaction.SIGHASH_FORKID;

function createPsbtFromUtxos (inUtxos) {
    const amounts = inUtxos.reduce((acc, x) => acc + x.satoshis, 0);
    const inputs = inUtxos.map(x => ({
        hash: x.txid,
        index: x.vout,
        nonWitnessUtxo: Buffer.from(x.rawtx, 'hex'),
        redeemScript: Buffer.from(x.redeem, 'hex'),
        sighashType: SIGHASH_TYPE,
        sequence: 1,
    }));

    const psbt = new bgold.Psbt({network});
    psbt.setLocktime(LOCK_TIME);
    psbt.addInputs(inputs);
    psbt.addOutput({
        address: TARGET,
        value: amounts - FEE,
    });
    // console.dir(psbt, {depth:6});
    return {psbt, amounts, inputs: inUtxos.map(({txid, vout}) => ({txid, vout}))};
}

function signAndUpdate(psbt, inputs, amounts, sigCounts, producedPsbt) {
    // try to sign
    for (let j = 0; j < psbt.data.inputs.length; j++) {
        let redeemScript = psbt.data.inputs[j].redeemScript;
        for (let k of keys) {
            if (redeemScript.indexOf(k.publicKey) >= 0) {
                psbt.signInput(j, k, [SIGHASH_TYPE]);
                break;
            }
        }
    }

    // update results
    const counters = psbt.data.inputs
        .map(x => x.partialSig ? x.partialSig.length : 0);
    sigCounts.push(...counters);
    const ser = psbt.toBase64();
    producedPsbt.push({
        inputs,
        amounts,
        fee: FEE,
        psbt: ser,
        signed: {
            max: counters.reduce((r, x) => Math.max(r, x), counters[0]),
            max: counters.reduce((r, x) => Math.min(r, x), counters[0]),
        },
    });
}

const inputPsbtFile = process.argv[2];

const sigCounts = [];
const producedPsbt = [];
if (inputPsbtFile) {
    const jsonInPsbts = fs.readFileSync(inputPsbtFile, {encoding: 'utf-8'});
    const inPsbts = JSON.parse(jsonInPsbts);
    for (let [i, inPsbt] of inPsbts.entries()) {
        console.log(`Signing tx ${i}/${inPsbts.length}`);
        const psbt = bgold.Psbt.fromBase64(inPsbt.psbt, {network});
        const {amounts, inputs} = inPsbt;
        signAndUpdate(psbt, inputs, amounts, sigCounts, producedPsbt);
    }
} else {
    for (let i = 0; i < utxo.length; i += INPUTS) {
        console.log(`Signing utxo ${i}/${utxo.length}`);
        const inUtxos = utxo.slice(i, i + INPUTS);
        const {psbt, amounts, inputs} = createPsbtFromUtxos(inUtxos);
        signAndUpdate(psbt, inputs, amounts, sigCounts, producedPsbt);
    }
}

// stats
const sigCountStats = sigCounts.reduce((acc, x) => {acc[x] = (acc[x] || 0) + 1; return acc}, {});
console.log({sigCountStats});

// filename
const aggSigCounts = Object.keys(sigCountStats).map(parseInt).sort();
const nameSuffix = aggSigCounts.length == 1
    ? `signed-${aggSigCounts[0]}`
    : `partial-${aggSigCounts[0]}-to-${aggSigCounts[aggSigCounts.length - 1]}`;

// save
const jsonSigned = JSON.stringify(producedPsbt, undefined, 2);
fs.writeFileSync(`./data/psbt-${nameSuffix}.json`, jsonSigned);
