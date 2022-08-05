/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand } from '../structures'
import {
  ApplicationCommandOptionType,
  Message,
  version as DJSVersion,
} from 'discord.js'
import dedent from 'dedent'
import { inlineCode, time } from '@discordjs/builders'
import { version } from '../constants'

export class SummaryCommand extends JejudoCommand {
  constructor(public jejudo: Jejudo) {
    super({
      type: ApplicationCommandOptionType.Subcommand,
      name: 'summary',
      description: 'Get info about your bot',
    })
  }

  async execute(msg: Message): Promise<void> {
    let content = dedent`Jejudo ${inlineCode(version)}, discord.js ${inlineCode(
      DJSVersion
    )}, Node.js ${inlineCode(process.versions.node)} on ${process.platform}
        Process started at ${time(
          new Date(Date.now() - process.uptime() * 1000),
          'R'
        )}, bot was ready at ${time(this.jejudo.client.readyAt as Date, 'R')}`
    content += `\nUsing ${(process.memoryUsage().rss / 1024 / 1024).toFixed(
      2
    )}MB of memory`
    content += `\nRunning on PID ${process.pid}`
    if (this.jejudo.client.shard) {
      const guilds = await this.jejudo.client.shard
        .broadcastEval<number>((c) => c.guilds.cache.size)
        .then((x) => x.reduce((a, b) => a + b, 0))
      const users = await this.jejudo.client.shard
        .broadcastEval<number>((c) => c.users.cache.size)
        .then((x) => x.reduce((a, b) => a + b, 0))
      content += `\n\nThis bot is sharded and can see ${guilds} guild(s) and ${users} user(s).`
    } else {
      content += `\n\nThis bot is not sharded and can see ${this.jejudo.client.guilds.cache.size} guild(s) and ${this.jejudo.client.users.cache.size} user(s).`
    }
    content += `\nAverage websocket latency: ${this.jejudo.client.ws.ping}ms`
    await msg.edit(content)
  }
}
