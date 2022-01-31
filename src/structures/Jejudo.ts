/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import {
  ApplicationCommandDataResolvable,
  Client,
  CommandInteraction,
  Interaction,
} from 'discord.js'
import { JejudoCommand } from './JejudoCommand'
import {
  DocsCommand,
  EvaluateCommand,
  SummaryCommand,
  ShellCommand,
} from '../commands'

type DocumentationSource = {
  name: string
  key: string
  url: string
}

export class Jejudo {
  private _commands: JejudoCommand[] = []
  documentationSources: DocumentationSource[] = []

  defaultPermission = false

  commandName: string

  owners: string[]

  noPermission: (i: CommandInteraction) => void

  isOwner: (i: Interaction) => boolean | Promise<boolean>

  secrets: string[]

  constructor(
    public client: Client,
    {
      owners = [],
      command = 'jejudo',
      noPermission = (i) => i.reply('No permission'),
      isOwner = () => false,
      globalVariables = {},
      secrets = [],
    }: {
      owners?: string[]
      command?: string
      noPermission?: (i: CommandInteraction) => void
      isOwner?: (i: Interaction) => boolean | Promise<boolean>
      globalVariables?: Record<string, object>
      secrets?: string[]
    }
  ) {
    this.owners = owners
    this.commandName = command
    this.noPermission = noPermission
    this.isOwner = isOwner
    this.secrets = secrets
    for (const [k, v] of Object.entries(globalVariables)) {
      ;(global as unknown as Record<string, object>)[k] = v
    }
    this.registerCommand(new SummaryCommand(this))
    this.registerCommand(new EvaluateCommand(this))
    this.registerCommand(new ShellCommand(this))
    this.registerCommand(new DocsCommand(this))
    this.addDocumentationSource({
      key: 'djs',
      name: 'Discord.JS',
      url: 'https://raw.githubusercontent.com/discordjs/docs/main/discord.js/stable.json',
    })
    this.addDocumentationSource({
      key: 'djs-collection',
      name: 'Discord.JS Collection',
      url: 'https://raw.githubusercontent.com/discordjs/docs/main/collection/stable.json',
    })
    this.addDocumentationSource({
      key: 'djs-voice',
      name: 'Discord.JS Voice',
      url: 'https://raw.githubusercontent.com/discordjs/docs/main/voice/stable.json',
    })
    this.addDocumentationSource({
      key: 'djs-builders',
      name: 'Discord.JS Builders',
      url: 'https://raw.githubusercontent.com/discordjs/docs/main/builders/stable.json',
    })
    this.addDocumentationSource({
      key: 'djs-rest',
      name: 'Discord.JS REST',
      url: 'https://github.com/discordjs/docs/raw/main/voice/stable.json',
    })
  }

  registerCommand(command: JejudoCommand) {
    this._commands.push(command)
  }

  get commandJSON(): ApplicationCommandDataResolvable {
    return {
      type: 'CHAT_INPUT',
      name: this.commandName,
      description: 'Jejudo debugging tool',
      defaultPermission: this.defaultPermission,
      options: this._commands.map((x) => x.data),
    }
  }

  addDocumentationSource(source: DocumentationSource) {
    this.documentationSources.push(source)
  }

  async run(i: Interaction) {
    if (!i.isCommand() && !i.isAutocomplete()) return
    if (i.commandName !== this.commandName) return
    if (!this.owners.includes(i.user.id)) {
      if (!(await this.isOwner(i))) {
        if (i.isCommand()) {
          return this.noPermission(i)
        }
      }
    }
    if (i.isAutocomplete()) {
      const options = i.options
      const sc = options.getSubcommand(true)
      const command = this._commands.find((x) => x.data.name === sc)
      if (!command) return
      await command.autocomplete(i)
      return
    }
    const subCommand = i.options.getSubcommand(true)
    const command = this._commands.find((x) => x.data.name === subCommand)
    if (!command)
      return i.reply({ content: 'Unknown feature', ephemeral: true })
    try {
      await command.execute(i)
    } catch (e) {
      if (!i.replied) {
        await i.deleteReply().catch((e) => console.error(e))
      }
      await i.user.send(`${e}`).catch((e) => console.error(e))
    }
  }
}
