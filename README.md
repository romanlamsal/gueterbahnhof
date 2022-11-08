# gueterbahnhof

Simple service orchestration server with integrated deployment process and proxy.

## Install & Start

Install gueterbahnhof and [pm2](https://github.com/Unitech/pm2) globally:
```
npm install -g @lamsal-de/gueterbahnhof pm2
```

The simplest way to start a gueterbahnhof server and get going would be the following command.
See below for more cli options.

```
gueterbahnhof server --port 3000
```

After your server is up and running, you can browse to http://localhost:3000 and configure some apps. 

## When you want this

If you have a server to which you'd like to deploy one or many services regularly with little overhead, 
**gueterbahhof** (german for *freight depot*) is for you.

If you have multiple servers and need to configure complex routing rules etc., then you better look
for something more potent.

## Short guide

This package includes a cli which can either start a gueterbahnhof server or interact with an existing one.

The server uses pm2 to process management and orchestration of _apps_, which can be configured either via cli or 
the server's management UI.

The server then serves as proxy for every started app you have configured.

A new deployment can be created via `gueterbahnhof deploy` command. After your new build artifact is deployed,
the server automatically (re)starts your service for you.
