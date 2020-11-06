require('dotenv').config()
const bgold = require('bgoldjs-lib');
const fs = require('fs');

const network = bgold.networks.bitcoingold;

const inputPsbtFile = process.argv[2];
if (!inputPsbtFile) {
    console.error('Invalid psbt file');
    process.exit(-1);
}


const jsonInPsbts = fs.readFileSync(inputPsbtFile, {encoding: 'utf-8'});
const inPsbts = JSON.parse(jsonInPsbts);

const outTxHex = [];
for (let [i, inPsbt] of inPsbts.entries()) {
    console.log(`Finalizing tx ${i}/${inPsbts.length}`);
    const psbt = bgold.Psbt.fromBase64(inPsbt.psbt, {network});
    // Validate and finalize
    const allInputsValidated = psbt.validateSignaturesOfAllInputs();
    const { address, value } = psbt.txOutputs[0];
    console.log('Tx:', { allInputsValidated, address, value });
    psbt.finalizeAllInputs();
    const txHex = psbt.extractTransaction().toHex();
    outTxHex.push(txHex);
}

const jsonFinalTx = JSON.stringify(outTxHex, undefined, 2);
fs.writeFileSync('./data/final-txes.json', jsonFinalTx, {encoding: 'utf-8'});
