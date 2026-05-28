import * as fs from 'fs/promises';
import * as proc from 'process';
import * as crypto from 'crypto';
import * as general from './utils.js';
import * as spawn from 'child_process';

let config = {
    files: '/srv/privsync/data',
    port: '8080',
    ssh_port: '22'
};
let passes = {};

/**
 * Change an object in a way that is also stored and fails safely, with no changes made.
 * @param {*} object Object to be changed. Should be json-parsable.
 * @param {function(*): Promise<void>} change Change to be applied to the object. Takes the object as input.
 * @param {string} file_path File path at which the object is stored.
 * @returns {void} Nothing.
 */
async function sync_to_file(object, change, file_path) {
    let dupe = JSON.parse(JSON.stringify(object));
    await change(dupe);
    await fs.writeFile(file_path + ".temp_", JSON.stringify(dupe));
    await change(object);
    await fs.writeFile(file_path, JSON.stringify(object));
}

function help() {
    console.log("Command syntax:\n" +
        "\t* help\n" +
        "\t* add <username> <pasword>\n" +
        "\t* set <setting> <value>\n" +
        "\t* exit\n" +
        "\t* remove <username> <password>\n" +
        "\t* cert\n" +
        "\t* gen-key" +
        "\t* update" +
        "Available settings: 'files' - where the bulk data should be stored\n" +
        "                    'ssh_port' - SSH port that's open to the internet\n" +
        "                    'port' - HTTPS port");
}

proc.stdin.on('data', async (data) => {
    let cmd = data.toString('utf-8');
    let params = cmd.trim().split(" ").filter((word) => word != "");
    let has_matched = false;
    if (params.length > 0) {
        if (params[0].match(/^he?l?p?/)) {
            help();
            has_matched = true;
        }
        if (params[0].match(/^ad?d?/)) {
            let name = params[1] || '';
            let pass = params[2] || '';
            if (!(/[-A-Za-z0-9_]+/.exec(name)[1] != name)) {
                console.log("Name is not made of the following characters: letters, digits or any of the string '_-'");
            }
            else if (name in passes) {
                console.log("Name is already in use!");
            } else {
                let salt = crypto.randomBytes(64).toString(general.config.encoding);
                try {
                    await fs.mkdir(config.files + '/' + name, {mode: 0o777, recursive: true});
                    spawn.execSync('chmod 755 ' + config.files + '/' + name);
                    spawn.execSync('chown privsync:privsync ' + config.files + '/' + name);
                    try {
                        await sync_to_file(passes, (passes) => {
                            passes[name] = {salt: salt, hash: general.hash(salt, pass)}
                        }, general.path('pass_file'));
                    } catch (err) {
                        console.log("Error when writing password master file!");
                    }
                } catch (err) {
                    console.log("Error when creating new user's folder!");
                }
            }
            has_matched = true;
        }
        if (params[0].match(/^ex?i?t?/)) {
            proc.exit(0);
        }
        if (params[0].match(/^re?mo?v?e?/)) {
            let name = params[1] || '' , pass = params[2] || '';
            let arr = general.auth(pass, name, passes);
            console.log(arr[1]);
            if (arr[0]) try {
                await sync_to_file(passes, (passes) => delete passes[name], general.path('pass_file'));
                try {
                    await fs.rm(config.files + '/' + name, {recursive: true});
                } catch (err) {
                    console.log("Error when removing user data!");
                }
            } catch (err) {
                console.log("Error when writing password master file!");
            }
            has_matched = true;
        }
        if (params[0].match(/^ge?n?-?k?e?y?/)) {
            try {
                console.log(spawn.execSync("ssh-keygen -N '' -f '" + general.path('keys_folder') + '/server\'').toString('utf-8'));
            } catch (err) {
                console.log(err);
            }
            has_matched = true;
        }
        if (params[0].match(/^se?t?/)) {
            await sync_to_file(config, async (cfg) => {
                const opt = params[1];
                const new_opt = params.slice(2).join(" ");
                if (opt == "files") {
                    const file = '/usr/sbin/ssh-wrapper.sh';
                    await fs.writeFile(file, (await fs.readFile(file, 'utf-8')).replace(cfg[opt], new_opt));
                }
                cfg[opt] = new_opt;
                
            }, general.path('config_file'));
            has_matched = true;
        }
        if (params[0].match(/^ce?r?t/)) {
            try {
                console.log(spawn.execSync("openssl genrsa -out /srv/privsync/keys/certificate.key 2048"));
                console.log(spawn.execSync("echo -e '.\\n.\\n\\nPrivSync\\n\\n\\n\\n\\n\\n\\n\\n\\n\\n\\n\\n' | openssl req -new -key /srv/privsync/keys/certificate.key -out /srv/privsync/keys/certificate.csr"));
                console.log(spawn.execSync("openssl x509 -req -days 365 -in /srv/privsync/keys/certificate.csr -signkey /srv/privsync/keys/certificate.key -out /srv/privsync/keys/certificate.crt"));
            } catch (err) {
                console.log(err);
            }
            has_matched = true;
        }
        if (!has_matched) {
            help();
        }
    }
    proc.stdout.write("> ");
})

async function main() {
    let new_config = JSON.parse(await fs.readFile(general.path('config_file')));
    for (let field in new_config) {
        config[field] = new_config[field]
    }
    passes = JSON.parse(await fs.readFile(general.path('pass_file')));
    proc.stdout.write("> ");
}

main();