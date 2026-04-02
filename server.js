import * as http from 'http';
import * as fs from 'fs/promises';
import * as general from './utils.js'

/**
 * @type {Object.<string, {hash: string, salt: string}>}
 */
let passes = {};

let config = {
    files: '/srv/privsync/data',
    local_user: 'privsync',
    local_home: '/home/privsync',
    key_name: 'server',
    port: '8080',
    ssh_port: '22'
};

/** @type {http.Server} */
let server;

let utils = {
    /** @type {Object.<string, Date>} */
    last_checks: {},
    check_last_change: async (file) => {
        let last_date = utils.last_checks[file] || new Date(null);
        utils.last_checks[file] = new Date(Date.now());
        let check = true;
        try {
            let changed_date = (await fs.stat(file)).mtime;
            check = changed_date >= last_date;
        } catch (err) {
            console.log( {err: err, where: 'check_last_change'});
        }
        return check;
    },
    read_config: async () => {
        if (await utils.check_last_change(general.path('config_file'))) try {
            let new_config = JSON.parse(await fs.readFile(general.path('config_file')));
            if (new_config.files && new_config.files != config.files) {
                for (let name in passes) try {
                    await fs.cp(config.files + '/' + name, new_config.files + '/' + name, {recursive: true});
                    await fs.rm(config.files + '/' + name, {recursive: true})
                } catch (err) {
                    console.log( {err: err, where: 'read_config_move'});
                }
                utils.block_syncs = false;
            }
            if (new_config.port && new_config.port != config.port) {
                server.close();
                server.listen(Number.parseInt(new_config.port, 10));
            }
            for (let attr in new_config) {
                config[attr] = new_config[attr];
            }
            if (new_config.key_name && new_config.key_name != config.key_name) try {
                let source = config.files + '/' + general.config.keys_folder + '/' + config.key_name;
                let dest = config.local_home + '/.ssh/' + config.key_name;
                await fs.cp(source, dest);
                await fs.cp(source + ".pub", dest + ".pub");
            } catch (err) {
                console.log( {err: err, where: 'read_config_key'});
            }
            console.log(config);
        } catch (err) {
            console.log( {err: err, where: 'read_config_read'});
        }
    },
    read_passes: async () => {
        if (await utils.check_last_change(general.path('pass_file'))) try {
            passes = JSON.parse(await fs.readFile(general.path('pass_file')));
            console.log(passes);
        } catch (err) {
            console.log( {err: err, where: 'read_passes'});
        }
    },
}

setInterval(utils.read_config, 60000);
setInterval(utils.read_passes, 60000);

/**
 * 
 * @param {{name: string, pass: string, key: string}} info User login & contact info.
 * @param {http.ServerResponse} res HTTPS response to fulfill.
 * @returns {Promise<void>} Nothing. 
 */
async function parse_respond(info, res) {
    let arr = general.auth(info.pass, info.name, passes);
    /** @type {{msg: string, status: boolean, user?: string, port?: string}} */
    let obj = {msg: arr[1], status: arr[0]};
    if (arr[0]) {
        // await fs.appendFile(config.local_home + "/.ssh/authorized_keys", info.key);
        obj.user = config.local_user;
        obj.port = config.ssh_port;
    }
    res.statusCode = 200;
    res.write(JSON.stringify(obj), (err) => {
        if (!err) {
            res.end();
        }
    })
}

async function main() {
    server = http.createServer(async (req, res) => {
        if (req.method == "POST") {
            let data = "";
            req.setEncoding('utf-8').on('data', (chunk) => {
                data += chunk;
            }).on('end', async (err) => {
                if (err)
                    console.log({err: err, where: 'login'});
                try {
                    await parse_respond(JSON.parse(data), res);
                } catch(err) {
                    console.log({err: err, where: 'login 2'});
                }
            });
        } else {
            res.statusCode = 404;
            res.end();
        }
    });
    await utils.read_config();
    await utils.read_passes();
    server.listen(Number.parseInt(config.port, 10))
}

main();