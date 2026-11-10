# Linklet URL Shortener

A small URL shortener built with Node.js and its built-in modules. No packages to install.

## Run it

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Set `PORT` to use a different port:

```sh
PORT=8080 npm start
```

Visit `/links.html` (or choose **Your links** on the home page) to browse and copy the saved short links.

Short links are stored in `links.json` in the project directory, so they survive server restarts.
