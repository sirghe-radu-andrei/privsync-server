import * as fs from 'fs/promises';
import * as proc from 'process';
import * as crypto from 'crypto';
import * as general from './utils.js';
import * as spawn from 'child_process';

let config = {};
let passes = {};

/**
 * Change an object in a way that is also stored and fails safely, with no changes made.
 * @param {*} object Object to be changed. Should be json-parsable.
 * @param {function(*): void} change Change to be applied to the object. Takes the object as input.
 * @param {string} file_path File path at which the object is stored.
 * @returns {void} Nothing.
 */
async function sync_to_file(object, change, file_path) {
    let dupe = JSON.parse(JSON.stringify(object));
    change(dupe);
    await fs.writeFile(file_path + ".temp_", JSON.stringify(dupe));
    change(object);
    await fs.writeFile(file_path, JSON.stringify(object));
}

proc.stdin.on('data', async (data) => {
    let cmd = data.toString('utf-8');
    let params = cmd.trim().split(" ").filter((word, i, a) => word != "");
    if (params.length > 0) {
        if (params[0].match(/^he?l?p?/)) {
            console.log("Command syntax:\n" +
                "\t* help\n" +
                "\t* add <username> <pasword>\n" +
                "\t* config <setting> <value>\n" +
                "\t* exit\n" +
                "\t* remove <username> <password>\n" +
                "Available settings: 'files' - where the bulk data should be stored");
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
                    await fs.mkdir(config.files + '/' + name);
                    try {
                        await sync_to_file(passes, (passes) => {
                            passes[name] = {salt: salt, hash: hash(salt, pass)}
                        }, general.path('pass_file'));
                    } catch (err) {
                        console.log("Error when writing password master file!");
                    }
                } catch (err) {
                    console.log("Error when creating new user's folder!");
                }
            }
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
        }
        if (params[0].match(/^ge?n?-?k?e?y?/)) {
            let name = params[1] || '';
            if (!name.match(/[-a-zA-Z_0-9]+/)) {
                console.log("Name should be alphanumeric with optional dashes and underscores!");
            } else {
                try {
                    console.log(spawn.execSync("ssh-keygen -N '' -f '" + general.path('keys_folder') + '/' + name + "'").toString('utf-8'));
                } catch (err) {
                    console.log(err);
                }
            }
        }
    }
    proc.stdout.write("> ");
})

async function main() {
    config = JSON.parse(await fs.readFile(general.path('config_file')));
    passes = JSON.parse(await fs.readFile(general.path('pass_file')));
    proc.stdout.write("> ");
}

main();