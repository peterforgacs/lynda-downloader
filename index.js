'use strict';
const fs	     = require('fs');
const fsx   	 = require('fs-extra');
const argv       = require('minimist')(process.argv.slice(2));
const parse      = require('url-parse');
const path       = require('path');
const exec 		 = require('child_process').exec;
const spawn 	 = require('child_process').spawn;

/*---- Validate ---------------------------------------------------
*   In case its used as a standalone program.
*------------------------------------------------------------------*/
if (!argv.urls || !argv.username || !argv.password){
	console.log('Missing arguments: node app --username=xxx --password=xxx --url=url');
	process.exit(1);
}

let baseDir = process.cwd();	// The path the process is being called on
if (argv.download){
	baseDir = argv.download;
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
let run = new module.exports(argv.username, argv.password);
run.setUrl(argv.urls)
.then( () => {
   run.start();
})
.catch( error => {
   console.log(error);
   process.exit(1);
});
