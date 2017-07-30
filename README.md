# lynda-dl

CLI tool for downloading lynda.com courses.
Alpha version, beware!

## Dependencies

You need to have the latest youtube downloader (2017.07.15) installed and in path.

https://youtube-dl.org/

## Install

```sh
npm install lynda-dl -g
```

## Use

```sh
lynda-dl
```

During the prompt you can specify:
* Your lynda.com username
* Your lynda.com password
* A course url or a file containing multiple course urls
* Download location

The username and password does not get saved.
The full course gets downloaded with subtitles.