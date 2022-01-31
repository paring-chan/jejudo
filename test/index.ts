/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Client, Team, User } from 'discord.js'
import { config } from './config'
import { Jejudo } from '../src'

const client = new Client({
  intents: ['GUILDS', 'GUILD_MESSAGES', 'DIRECT_MESSAGES'],
  partials: ['CHANNEL', 'MESSAGE'],
})

const jejudo = new Jejudo(client, {
  isOwner: (i) => owners.includes(i.user.id),
})

jejudo.defaultPermission = true

let owners: string[] = []

client.once('ready', async () => {
  const owner = (await client.application?.fetch())?.owner

  if (owner instanceof Team) {
    owners = owner.members.map((x) => x.id)
  } else if (owner instanceof User) {
    owners = [owner.id]
  }

  await client.guilds.cache
    .get(config.commandGuild)
    ?.commands.set([jejudo.commandJSON])
  console.log('ready')
})

client.on('interactionCreate', (i) => jejudo.run(i))

client.login(config.token).then()
