/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import {
  ApplicationCommandDataResolvable,
  Client,
  Interaction,
} from 'discord.js'
import { JejudoCommand } from './JejudoCommand'
import { EvaluateCommand } from '../commands'
import { SummaryCommand } from '../commands/Summary'
import { ShellCommand } from '../commands/Shell'

export class Jejudo {
  private _commands: JejudoCommand[] = []

  commandName = 'jejudo'

  constructor(public client: Client, public owners: string[] = []) {
    this.registerCommand(new SummaryCommand(this))
    this.registerCommand(new EvaluateCommand(this))
    this.registerCommand(new ShellCommand(this))
  }

  registerCommand(command: JejudoCommand) {
    this._commands.push(command)
  }

  get commandJSON(): ApplicationCommandDataResolvable {
    return {
      type: 'CHAT_INPUT',
      name: this.commandName,
      description: 'Jejudo debugging tool',
      defaultPermission: false,
      options: this._commands.map((x) => x.data),
    }
  }

  async run(i: Interaction) {
    if (!i.isCommand()) return
    if (i.commandName !== this.commandName) return
    if (!this.owners.includes(i.user.id))
      return i.reply({ content: 'No permission', ephemeral: true })
    const subCommand = i.options.getSubcommand(true)
    const command = this._commands.find((x) => x.data.name === subCommand)
    if (!command)
      return i.reply({ content: 'Unknown feature', ephemeral: true })
    try {
      await command.execute(i)
    } catch (e) {
      if (!i.replied) {
        await i.editReply('Command failed')
      } else {
        await i.reply('Command failed')
      }
      await i.user.send(`${e}`)
    }
  }
}
