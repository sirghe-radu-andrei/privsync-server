import * as crypto from 'crypto'

export let config = {
    prefix: '/srv/private_synchronizer',
    pass_file: 'passwords.json',
    config_file: 'config.json',
    keys_folder: 'keys',
    hash: 'sha512',
    encoding: 'hex'
}

/**
 * Validate a user's existence and password.
 * @param {string} pass 
 * @param {Object.<{salt: string, hash: string}>} user_info 
 * @returns {[boolean, string]} Auth status & message.
 */

export function hash(salt, pass) {
    return crypto.createHash(config.hash).update(salt + pass + salt).digest().toString(config.encoding);
}

export function auth(pass, name, passes) {
    if (!(name in passes)) {
        return [false, "User does not exist!"];
    } 
    if (passes[name].hash != hash(passes[name].salt, pass)) {
        return [false, "Wrong password!"];
    }
    return [true, "OK!"];
}

export function path(param_name) {
    return config.prefix + '/' + config[param_name];
}