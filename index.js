#!/usr/bin/env node
'use strict';
const fs  = require('fs'),
fsx   	  = require('fs-extra'),
clear		  = require('clear'),
figlet    = require('figlet'),
chalk     = require('chalk'),
argv      = require('minimist')(process.argv.slice(2)),
inquirer  = require('inquirer'),
parse     = require('url-parse'),
path      = require('path'),
program   = require('commander'),
pkginfo   = require('pkginfo')(module),
spawn 	  = require('child_process').spawn;

/*---- Arguments --------------------------------------------------------------
*  Show help and parse arguments
-------------------------------------------------------------------------------*/
program
  .version(pkginfo.version)
  .option('-u, --username', 'lynda.com username')
  .option('-p, --password', 'lynda.com password')
	.option('-U, --url', 'lynda.com url')
	.option('-f, --file', 'file containing lynda.com urls')
  .parse(process.argv);


/*---- Command line -----------------------------------------------------------
*  Various command line tweaks
-------------------------------------------------------------------------------*/
clear();
console.log(
  chalk.yellow(
    figlet.textSync('Lynda Downloader', { horizontalLayout: 'full' })
  )
);

/*---- Validate ---------------------------------------------------------------
*   In case its used as a standalone program.
*-----------------------------------------------------------------------------*/
let baseDir = process.cwd();	// The path the process is being called on
if (argv.download){
	baseDir = argv.download;
}

if (!argv.urls || !argv.username || !argv.password){
	interactivePrompt( credentials => {
		argv.username = credentials.username;
		argv.password = credentials.password;
		argv.urls = credentials.urls;
		downThemAll();
	});
} else {
	downThemAll();
}

function interactivePrompt(callback){
	var questions = [
    {
      name: 'username',
      type: 'input',
      message: 'Enter your Lynda.com username or e-mail address:',
      validate: function( value ) {
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
      name: 'urls',
      type: 'choice',
      message: 'URL type:',
      validate: function(value) {
        if (value.length) {
          return true;
        } else {
          return 'Please the correct filename';
        }
      }
    }
  ];

  inquirer.prompt(questions).then(callback);
}

module.exports = class LyndaDownloader {
	constructor(username, password){
		this.username = username;
		this.password = password;
		this.urls    = [];
	}

	validate(file){
		fsx.ensureFile(file)
		.catch( error => {
			console.log(error);
			console.log('Not valid files.');
			process.exit(1);
		});
	}

	setUrl(urls){
		return new Promise ( (resolve, reject) => { 
			if (!urls || typeof urls !== "string")
				{
					reject('Invalid URL.');
				}

			this.validate(urls);
			fs.readFile(urls, (err, data) => {
				if(err) throw err;
				var lines = data.toString().split("\n");
				lines.forEach( line => {
					this.urls.push(this.parse(line));
					console.log(`Added URL: ${line}`);
				}, this);
				resolve();
			});
		});
	}

	start(){
		let promise = Promise.resolve();
		this.urls.forEach(url => {
    		promise = promise.then(() => {
        		return this.download(url);
    		});
		});
		promise.then(() => {
			console.log('Downloads are finished!');
		})
		.catch( error => {
			console.log(error);
			process.exit(1);
		});
	}

	parse(line){
		let parsedUrl = parse(line);
		let fileName = path.basename(parsedUrl.pathname);
		parsedUrl.dir = parsedUrl.pathname.replace(fileName, '');
		return parsedUrl;
	}

	download(url){
		return new Promise ( (resolve, reject) => {
			let downloadPath = process.cwd() + url.dir;	// /home/peter/nodejs/lynda-downloader/Software-Development-tutorials/Foundations-Programming-Web-Services

			return fsx.ensureDir(downloadPath)
			.then( () => {

				process.chdir(downloadPath);
				
				let args = [
					'--all-subs',  '-o', 
					'"%(playlist_index)s-%(title)s.%(ext)s"',  url,
					'--username', this.username,
					'--password', this.password
				];
				
				console.log(args);
				let youtube = spawn('youtube-dl', args );

				youtube.stdout.on('data', (data) => {
					console.log(data.toString('utf8'));
				});

				youtube.stderr.on('data', (error) => {
					console.log(error.toString('utf8'));
					reject(error);
				});

				youtube.on('close', (code) => {
					console.log(`Closing download.`);
					process.chdir(baseDir);
					resolve();		
				});
			});
		});
	}
};

/*---- Example ----------------------------------------------------
*   Test download run.
*-------------------------------------------------------------------*/
function downThemAll(){
	let run = new module.exports(argv.username, argv.password);
	run.setUrl(argv.urls)
	.then( () => {
		run.start();
	})
	.catch( error => {
		console.log(error);
		process.exit(1);
	});
}