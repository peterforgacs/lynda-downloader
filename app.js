'use strict';
const fs	     = require('fs');
const fsx   	 = require('fs-extra');
const readline 	 = require('readline');
const argv       = require('minimist')(process.argv.slice(2));
const parse      = require('url-parse');
const exec 		 = require('child_process').exec;

// Validate input --------------------------------------------
if (!argv.url || !argv.cookie){
	console.log('Missing arguments.');
	process.exit(1);
} else {
	fsx.ensureFile(argv.url)
	.then( () => {
	   fsx.ensureFile(argv.cookie);
	})
	.catch( error => {
	   	console.log(error);
		console.log('Not valid files.');
		process.exit(1);
	});
}

// Read in url list -------------------------------------------
var rd = readline.createInterface({
	 	input: fs.createReadStream(argv.url),
	 	output: process.stdout,
		console: false
});

rd.on('line', function(line) {
		let classTopic = parse(line);
		fsx.ensureDir(__dirname + classTopic.pathname)
		// TODO: Remove the html part
		.then(() => {
			console.log('success!')
		})
		.catch(err => {
			console.error(err);
			process.exit(0);
		});
});

function download(url) {
	exec(`youtube-dl --cookies ${argv.cookie} --all-subs -o "%(playlist_index)s-%(title)s.%(ext)s ${url}`, (error, stdout) => {
		if (error) {
			console.log(error);
		}		
	});
}