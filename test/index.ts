/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Client, Team, User } from 'discord.js'
import { config } from './config'
import { Jejudo } from '../src'

const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'DirectMessages'],
})

const jejudo = new Jejudo(client, {
  isOwner: (user) => owners.includes(user.id),
  prefix: '<@768092416846069760> ',
  textCommand: 'jejudo',
})

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

client.on('interactionCreate', (i) => {
  jejudo.handleInteraction(i)
})

client.on('messageCreate', (i) => {
  jejudo.handleMessage(i)
})

client.login(config.token).then()
