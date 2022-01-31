/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand } from '../structures'
import {
  AutocompleteInteraction,
  CommandInteraction,
  MessageEmbed,
} from 'discord.js'
import Doc from 'discord.js-docs'

export class DocsCommand extends JejudoCommand {
  constructor(public jejudo: Jejudo) {
    super({
      type: 'SUB_COMMAND',
      name: 'docs',
      description: 'Documentation',
      options: [
        {
          type: 'STRING',
          name: 'source',
          description: 'source for docs',
          required: true,
          autocomplete: true,
        },
        {
          type: 'STRING',
          name: 'keyword',
          description: 'keyword for docs',
          required: true,
          autocomplete: true,
        },
      ],
    })
  }

  async autocomplete(i: AutocompleteInteraction): Promise<void> {
    const focused = i.options.getFocused(true)
    if (focused.name === 'source') {
      return i.respond(
        this.jejudo.documentationSources
          .filter((x) =>
            x.name
              .toLowerCase()
              .includes((focused.value as string).toLowerCase())
          )
          .map((x) => ({
            name: x.name,
            value: x.key,
          }))
      )
    } else if (focused.name === 'keyword') {
      const source = this.jejudo.documentationSources.find(
        (x) => x.key === i.options.getString('source')
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

  async execute(i: CommandInteraction): Promise<void> {
    const source = this.jejudo.documentationSources.find(
      (x) =>
        x.key === i.options.getString('source') ?? this.jejudo.defaultDocsSource
    )
    if (!source) return i.reply('Unknown documentation source')

    const doc = await Doc.fetch(source.url)

    const embed = await doc.resolveEmbed(i.options.getString('keyword', true))

    if (!embed) {
      return i.reply({ content: 'No search results found' })
    }

    const e = new MessageEmbed(embed)
    e.fields.forEach((x) => {
      if (x.value.length > 1023) {
        x.value = x.value.slice(0, 1020) + '...'
      }
    })

    await i.reply({
      embeds: [e],
    })
  }
}
