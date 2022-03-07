# @paulkre/wpdeploy

`wpdeploy` is a command line tool for deploying WordPress themes and plugins via HTTP.

## Installation

```bash
npm install --global @paulkre/wpdeploy
```

## Usage

```bash
wpdeploy --type <theme|plugin> \
  --url https://example.com \
  -u <user> -p <password> \
  plugin-or-theme.zip
```

Make sure the language of the user account is set to English, otherwise the deployment will not work.
