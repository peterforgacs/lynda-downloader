'use strict';
const fs	     = require('fs');
const fsx   	 = require('fs-extra');
const argv       = require('minimist')(process.argv.slice(2));
const parse      = require('url-parse');
const path       = require('path');
const exec 		 = require('child_process').spawn;

/*---- Validate ---------------------------------------------------
*   In case its used as a standalone program.
*------------------------------------------------------------------*/
if (!argv.urls || !argv.cookies){
	console.log('Missing arguments.');
	process.exit(1);
}

module.exports = class LyndaDownloader {
	constructor(cookies, urls){
		this.validate(cookies, urls);
		this.urls    = [];
		this.cookies =  cookies;
	}

	validate(cookies, urls){
		fsx.ensureFile(cookies)
			.then( () => {
			fsx.ensureFile(urls);
			})
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

			fs.readFile(urls, (err, data) => {
				if(err) throw err;
				var lines = data.toString().split("\n");
				lines.forEach( line => {
					this.urls.push(this.parse(line));
				}, this);
				console.log(this.urls);
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
			let downloadPath = __dirname + url.dir;	// /home/peter/nodejs/lynda-downloader/Software-Development-tutorials/Foundations-Programming-Web-Services
			let cookiesPath;

			return fsx.ensureDir(downloadPath)
			.then( () => {
				
				process.chdir(downloadPath);
				
				if(path.isAbsolute(this.cookies)) {
					 cookiesPath = this.cookies;
				} else {
					cookiesPath = __dirname + '/' + this.cookies;
				}

				// TODO: Use spawn https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options
				exec(`youtube-dl --cookies ${cookiesPath} --all-subs -o "%(playlist_index)s-%(title)s.%(ext)s" ${url}`, (error, stdout) => {
				if (error) {
					console.log(error);
					reject(error);
				}

				process.chdir(__dirname);
				resolve();		
				});
			});
		});
	}
};

/*---- Example ----------------------------------------------------
*   Test download run.
*-------------------------------------------------------------------*/
let run = new module.exports(argv.cookies, argv.urls);
run.setUrl(argv.urls)
.then( () => {
   run.start();
})
.catch( error => {
   console.log(error);
   process.exit(1);
});
