/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import {
  ApplicationCommandDataResolvable,
  ApplicationCommandType,
  ChatInputCommandInteraction,
  Client,
  CommandInteraction,
  Interaction,
  Message,
  PermissionResolvable,
  User,
} from 'discord.js'
import { JejudoCommand } from './JejudoCommand'
import {
  DocsCommand,
  EvaluateCommand,
  SummaryCommand,
  ShellCommand,
} from '../commands'
import { version } from '../constants'

type DocumentationSource = {
  name: string
  key: string
  url: string
}

export class Jejudo {
  private _commands: JejudoCommand[] = []
  documentationSources: DocumentationSource[] = []

  defaultDocsSource = 'djs'

  defaultMemberPermissions?: PermissionResolvable

  commandName: string

  owners: string[]

  noPermission: (i: ChatInputCommandInteraction | Message) => void

  isOwner: (user: User) => boolean | Promise<boolean>

  prefix?: string
  textCommandName: string[]

  secrets: string[]

  constructor(
    public client: Client,
    {
      owners = [],
      command = 'jejudo',
      noPermission = (i) => i.reply('No permission'),
      isOwner = () => false,
      textCommand,
      globalVariables = {},
      secrets = [],
      prefix,
      registerDefaultCommands = true,
    }: {
      owners?: string[]
      prefix?: string
      textCommand?: string
      command?: string
      noPermission?: (i: CommandInteraction | Message) => void
      isOwner?: (user: User) => boolean | Promise<boolean>
      globalVariables?: Record<string, object>
      secrets?: string[]
      registerDefaultCommands?: boolean
    }
  ) {
    this.owners = owners
    this.commandName = command
    this.noPermission = noPermission
    this.isOwner = isOwner
    const tc = textCommand || 'jejudo'
    this.textCommandName = typeof tc === 'string' ? [tc] : tc
    this.prefix = prefix
    this.secrets = secrets
    for (const [k, v] of Object.entries(globalVariables)) {
      ;(global as unknown as Record<string, object>)[k] = v
    }
    if (registerDefaultCommands) {
      this.registerCommand(new SummaryCommand(this))
      this.registerCommand(new EvaluateCommand(this))
      this.registerCommand(new ShellCommand(this))
      this.registerCommand(new DocsCommand(this))
    }
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
    this.addDocumentationSource({
      key: 'jejudo',
      name: 'Jejudo',
      url: `https://github.com/pikokr/docs/raw/main/jejudo/${
        version.includes('dev') ? 'dev' : 'stable'
      }.json`,
    })
  }

  registerCommand(command: JejudoCommand) {
    this._commands.push(command)
  }

  get commandJSON(): ApplicationCommandDataResolvable {
    return {
      type: ApplicationCommandType.ChatInput,
      name: this.commandName,
      description: 'Jejudo debugging tool',
      defaultMemberPermissions: this.defaultMemberPermissions,
      options: this._commands.map((x) => x.data),
    }
  }

  addDocumentationSource(source: DocumentationSource) {
    this.documentationSources.push(source)
  }

  async handleMessage(msg: Message) {
    if (!this.prefix) return
    if (!msg.content.startsWith(this.prefix)) return

    if (!this.owners.includes(msg.author.id)) {
      if (!(await this.isOwner(msg.author))) {
        return this.noPermission(msg)
      }
    }

    const content = msg.content.slice(this.prefix.length)

    const split = content.split(' ')

    const name = split.shift()

    if (!name) return

    if (!this.textCommandName.find((x) => x !== name)) return

    const commandName = split.shift() ?? 'summary'

    const command = this._commands.find(
      (x) =>
        x.data.name === commandName ||
        x.textCommandAliases.includes(x.data.name)
    )

    if (!command) return

    const m = await msg.reply('Preparing...')

    command.execute(m, split.join(' '), msg.author)
  }

  async handleInteraction(i: Interaction) {
    if (!i.isChatInputCommand() && !i.isAutocomplete()) return
    if (i.commandName !== this.commandName) return
    if (!this.owners.includes(i.user.id)) {
      if (!(await this.isOwner(i.user))) {
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
    if (!i.channel) return
    const subCommand = i.options.getSubcommand(true)
    const command = this._commands.find((x) => x.data.name === subCommand)
    if (!command)
      return i.reply({ content: 'Unknown feature', ephemeral: true })
    try {
      let args = ''

      let first = true

      const options = i.options.data[0].options

      if (!options) return

      for (const item of options) {
        if (first) {
          args += item.value
          first = false
          continue
        }

        args += ` --${item.name} ${JSON.stringify(item.value)}`
      }

      const msg = await i.reply({ content: 'Preparing...', fetchReply: true })

      await command.execute(msg, args, i.user)
    } catch (e) {
      if (!i.replied) {
        await i.deleteReply().catch((e) => console.error(e))
      }
      await i.user.send(`${e}`).catch((e) => console.error(e))
    }
  }
}
