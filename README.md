# BTG Endowment Move

## Basic usage

Prepare:

1. Make sure you have `node >= v12` and `yarn` installed.
2. Copy `.env.sample` to `.env` and modify the file to add your private keys (separated by comma)

Sign the transactions:

```bash
# Install dependency (only the first time)
yarn
# Run unlock script to sign the psbt. Specify the latest psbt json file as the argument
node unlock.js data/psbt-signed-1.json
```

It generates logs like below if everything is good:

```log
Signing utxo 0/3271
Signing utxo 100/3271
Signing utxo 200/3271
Signing utxo 300/3271
...
{ sigCountStats: { '1': 3271 } }  (3271 utxos are signed with one sigs)
```

Then it will produce a new file `data/psbt-signed-{#sigs}.json`. Share it with other parties.

## Docker

Docker can be used to simplify the prepration process. It helps if you don't want to install a full Node.js + Yarn environment on your OS.

[Install Docker](https://docs.docker.com/get-docker/)

1. Put this repo under your working dir
    - e.g. Your working dir: `~/docker`
    - Then put this repo to: `~/docker/btg-endowment-move`
2. Insert your privkeys to the `.env` file in `btg-endowment-move/` as mentioned in the previous section
3. At the working dir, run: `docker run --rm -it -v $PWD/btg-endowment-move:/btg-endowment-move node:lts bash` (sudo may be required; add it in front of the command when necessary)
4. Now you get a ready-to-use shell. The repo on the host is mapped to `/btg-endowment-move` on the container side. Now you can enter the repo and run the signing tool:

    ```bash
    cd /btg-endowment-move
    yarn
    node unlock.js data/psbt-signed-1.json
    ```

5. Exit the container by `exit`. The container will be destroyed automatically, but the changes to the repo is still there.
