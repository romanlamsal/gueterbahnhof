#!/usr/bin/env node

import { program } from "commander"
import serverCommand from "@gueterbahnhof/server"
import clientCommand from "@gueterbahnhof/client"

program.addCommand(serverCommand).addCommand(clientCommand)

program.parse(process.argv)
