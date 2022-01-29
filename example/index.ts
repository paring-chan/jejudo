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

const jejudo = new Jejudo(client, [])

client.once('ready', async () => {
  const owner = (await client.application?.fetch())?.owner

  if (owner instanceof Team) {
    jejudo.owners = owner.members.map((x) => x.id)
  } else if (owner instanceof User) {
    jejudo.owners = [owner.id]
  }

  await client.guilds.cache
    .get(config.commandGuild)
    ?.commands.set([jejudo.commandJSON])
  await client.guilds.cache
    .get(config.commandGuild)
    ?.commands.cache.find((x) => x.name === 'jejudo')
    ?.permissions.set({
      permissions: jejudo.owners.map((x) => ({
        type: 'USER',
        id: x,
        permission: true,
      })),
    })
  console.log('ready')
})

client.on('interactionCreate', (i) => jejudo.run(i))

client.login(config.token).then()
