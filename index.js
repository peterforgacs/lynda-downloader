#!/usr/bin/env node

'use strict';
const fs     = require('fs'),
    fsx      = require('fs-extra'),
    clear    = require('clear'),
    figlet   = require('figlet'),
    chalk    = require('chalk'),
    inquirer = require('inquirer'),
    parse    = require('url-parse'),
    path     = require('path'),
    program  = require('commander'),
    pkginfo  = require('pkginfo')(module, { include: ['version'] }),
    spawn    = require('child_process').spawn;

/*---- Enviroment --------------------------------------------------------------
*  Enviroment based changes
-------------------------------------------------------------------------------*/
if (process.env.debug){
    console.log('Debug mode.');
    Error.stackTraceLimit = Infinity;
}

function doesExist(input, current) {
    if (!input) {
        return current;
    }

    let dir = input;

    if (!path.isAbsolute(input)) {
        dir = process.cwd() + input;
    }

    fsx.ensureDir(dir)
        // Create direcotry if does not exist
        .then(res => {
            console.log(`${dir} created.`);
            return dir;
        })
        // If can't create directory use the current one
        .catch(error => {
            console.erro(error);
            console.error('Not valid download location using current directory.');
            return current;
        });
}

function whichMode(input, someother) {
    if (isUrl(input)) {
        program.mode = 'url';
        return true;
        //return input;
    } else if (isFile(input)) {
        program.mode = 'file';
        //return input;
        return true;
    } else {
        console.error('Invalid url argument.');
        //interact();
        return false;
    }
}

function isFile(file) {
    if (path.isAbsolute(file)) {
        console.log(fs.existsSync(file), 'Absolute exists state');
        return fs.existsSync(file);
    }

    console.log(process.cwd() + '/' + file);
    console.log(fs.existsSync(process.cwd() + '/' + file), 'Relative exists state');
    return fs.existsSync(process.cwd() + '/' + file);
}

function isUrl(subject) {
    let url = parse(subject);
    if (url && url.protocol === 'http:' || url.protocol === 'https:') {
        return true;
    }

    return false;
}

/*---- Commander --------------------------------------------------------------
*  Show help and parse arguments
-------------------------------------------------------------------------------*/
program
    .version(module.exports.version)
    .usage('-u <username> -p <password> -U [<filename> | <URL>]')
    .option('-u, --username', 'lynda.com username')
    .option('-p, --password', 'lynda.com password')
    .option('-d, --download', 'download location', (input) => { 
        doesExist(input, process.cwd());
     })
    .option('-U, --url', 'lynda.com url or file path contianing urls', whichMode, 'something')
    .parse(process.argv);

/*---- Command line -----------------------------------------------------------
*  Fullscreen mode
-------------------------------------------------------------------------------*/
clear();
console.log(
    chalk.yellow(
        figlet.textSync('Lynda Downloader', { horizontalLayout: 'full' })
    )
);

/*---- Logic ------------------------------------------------------------------
 *   Use the given commnand line options or start interactive mode
 *-----------------------------------------------------------------------------*/
if (!program.url || !program.username || !program.password) {
    interact();
} else {
    downThemAll();
}

function interactivePrompt(callback) {
    var questions = [{
            name: 'username',
            type: 'input',
            message: 'Enter your Lynda.com username or e-mail address:',
            validate: function(value) {
                if (value.length) {
                    return true;
                } else {
                    return 'Please enter your username or e-mail address';
                }
            }
        },
        {
            name: 'password',
            type: 'password',
            message: 'Enter your Lynda.com password:',
            validate: function(value) {
                if (value.length) {
                    return true;
                } else {
                    return 'Please enter your password';
                }
            }
        },
        {
            name: 'url',
            type: 'input',
            message: 'The url of the course or path to the file containing multiple courses:',
            validate: function(value) {
                if (value.length && whichMode(value)) {
                    return true;
                } else {
                    return 'Please enter a valid url or path.';
                }
            }
        },
        {
            name: 'download',
            type: 'input',
            message: 'Download location:',
            default: function () {
                return process.cwd();
            },
            validate: function(value) {
                if (value.length) {
                    doesExist(value, process.cwd());
                    return true;
                } else {
                    return 'Please enter a valid url or path.';
                }
            }
        }
    ];

    inquirer.prompt(questions).then(callback);
}

function interact() {
    interactivePrompt(credentials => {
        program.username = credentials.username;
        program.password = credentials.password;
        program.url = credentials.url;
        program.download = credentials.download;
        downThemAll();
    });
}

class LyndaDownloader {
    constructor(username, password, cwd, mode) {
        this.username = username;
        this.password = password;
        this.cwd = cwd;
        this.mode = mode;
        this.urls = [];
    }

    validate(file) {
        fsx.ensureFile(file)
            .catch(error => {
                console.log(error);
                console.log('Not valid files.');
                process.exit(1);
            });
    }

    setUrl(urls) {
        return new Promise((resolve, reject) => {
            // Checking here since it can be used as a module
            if (!urls || typeof urls !== "string") {
                reject('Invalid URL.');
            }
            switch (this.mode) {
                case 'url':
                    if (isUrl(urls)) {
                        this.urls.push(this.parse(urls));
                        console.log(`Added URL: ${urls}`);
                    }
                    resolve();
                    break;
                case 'file':
                    this.validate(urls); // TODO: Make url version
                    fs.readFile(urls, (err, data) => {
                        if (err) throw err;
                        var lines = data.toString().split("\n");
                        lines.forEach(line => {
                            if (isUrl(line)) {
                                this.urls.push(this.parse(line));
                                console.log(`Added URL: ${line}`);
                            }
                        }, this);
                        resolve();
                    });
                    break;
                default:
                    console.error('Invalid mode.');
                    process.exit(1);
                    break;
            }
        });
    }

    start() {
        let promise = Promise.resolve();
        this.urls.forEach(url => {
            promise = promise.then(() => {
                return this.download(url);
            });
        });
        promise.then(() => {
                console.log('Downloads are finished!');
            })
            .catch(error => {
                console.log(error);
                process.exit(1);
            });
    }

    parse(line) {
        let parsedUrl = parse(line);
        let fileName = path.basename(parsedUrl.pathname);
        parsedUrl.dir = parsedUrl.pathname.replace(fileName, '');
        return parsedUrl;
    }

    download(url) {
        return new Promise((resolve, reject) => {
            let downloadPath = this.cwd + url.dir; // /home/peter/nodejs/lynda-downloader/Software-Development-tutorials/Foundations-Programming-Web-Services

            return fsx.ensureDir(downloadPath)
                .then(() => {

                    process.chdir(downloadPath);

                    let args = [
                        '--all-subs', '-o',
                        '"%(playlist_index)s-%(title)s.%(ext)s"', url,
                        '--username', this.username,
                        '--password', this.password
                    ];

                    console.log(args);
                    let youtube = spawn('youtube-dl', args);

                    youtube.stdout.on('data', (data) => {
                        console.log(data.toString('utf8'));
                    });

                    youtube.stderr.on('data', (error) => {
                        console.log(error.toString('utf8'));
                        reject(error);
                    });

                    youtube.on('close', (code) => {
                        console.log(`Closing download.`);
                        process.chdir(this.cwd);
                        resolve();
                    });
                });
        });
    }
}

/*---- Example ----------------------------------------------------
 *   Test download run.
 *-------------------------------------------------------------------*/
function downThemAll() {
    console.log(program.username, program.password, program.download, program.mode);
    let run = new LyndaDownloader(program.username, program.password, program.download, program.mode);
    run.setUrl(program.url)
        .then(() => {
            run.start();
        })
        .catch(error => {
            console.log(error);
            process.exit(1);
        });
}