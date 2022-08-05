/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand } from '../structures'
import {
  ApplicationCommandOptionType,
  AutocompleteInteraction,
  EmbedBuilder,
  Message,
} from 'discord.js'
import Doc from 'discord.js-docs'
import yargs from 'yargs'

export class DocsCommand extends JejudoCommand {
  constructor(public jejudo: Jejudo) {
    super({
      type: ApplicationCommandOptionType.Subcommand,
      name: 'docs',
      description: 'Documentation',
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'keyword',
          description: 'keyword for docs',
          required: true,
          autocomplete: true,
        },
        {
          type: ApplicationCommandOptionType.String,
          name: 'source',
          description: 'source for docs',
          required: false,
          choices: jejudo.documentationSources.map((x) => ({
            name: x.name,
            value: x.key,
          })),
        },
      ],
    })
  }

  async autocomplete(i: AutocompleteInteraction): Promise<void> {
    const focused = i.options.getFocused(true)
    if (focused.name === 'keyword') {
      const source = this.jejudo.documentationSources.find(
        (x) =>
          x.key ===
          (i.options.getString('source') ?? this.jejudo.defaultDocsSource)
      )
      if (!source) return i.respond([])

      const doc = await Doc.fetch(source.url)

      const searchResults = await doc.search(focused.value as string)

      if (!searchResults) return i.respond([])

      await i.respond(
        Array.from(
          new Set((searchResults as { name: string }[]).map((x) => x.name))
        ).map((x) => ({
          name: x,
          value: x,
        }))
      )
    }
  }

  async execute(msg: Message, args: string): Promise<void> {
    const channel = msg.channel
    const parsedArgs = await yargs.parseAsync(args)

    console.log(parsedArgs)

    if (!parsedArgs._.length) {
      await channel.send('Keyword is missing')
      return
    }

    const source = this.jejudo.documentationSources.find(
      (x) => x.key === (parsedArgs.source ?? this.jejudo.defaultDocsSource)
    )
    if (!source) {
      await msg.edit('Unknown documentation source')
      return
    }

    const doc = await Doc.fetch(source.url)

    const embed = await doc.resolveEmbed(parsedArgs._.join(' '))

    if (!embed) {
      await msg.edit({ content: 'No search results found' })
      return
    }

    const e = new EmbedBuilder(embed)
    e.data.fields?.forEach((x) => {
      if (x.value.length > 1023) {
        x.value = x.value.slice(0, 1020) + '...'
      }
    })

    await channel.send({
      embeds: [e],
    })
  }
}
