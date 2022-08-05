/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand } from '../structures'
import {
  ApplicationCommandOptionType,
  ButtonBuilder,
  ActionRowBuilder,
  codeBlock,
  ButtonStyle,
  MessageActionRowComponentBuilder,
  ComponentType,
  User,
  Message,
  ButtonInteraction,
} from 'discord.js'
import * as util from 'util'

export class EvaluateCommand extends JejudoCommand {
  constructor(public jejudo: Jejudo) {
    super({
      type: ApplicationCommandOptionType.Subcommand,
      name: 'eval',
      description: 'Evaluate js code',
      options: [
        {
          type: ApplicationCommandOptionType.String,
          name: 'code',
          description: 'Code to run',
          required: true,
        },
      ],
    })
  }
  async execute(msg: Message, code: string, author: User): Promise<void> {
    if (!code) {
      await msg.edit('code is missing')
      return
    }
    const channel = msg.channel

    const r = msg

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const client = this.jejudo.client

    try {
      const result = await eval(code)
      const lines = (
        typeof result === 'string'
          ? result
          : util.inspect(result, {
              maxArrayLength: 200,
              depth: 2,
            })
      )
        .split('\n')
        .map((x) => {
          let res = x
          for (const secret of [
            ...this.jejudo.secrets,
            this.jejudo.client.token as string,
          ]) {
            res = x.split(secret).join('[secret]')
          }
          return res
        })
      const chunks: string[] = []
      let current = ''
      for (const line of lines) {
        if (current.length + line.length + 1 > 1990) {
          chunks.push(current)
          current = line
          continue
        }
        current += '\n' + line
      }
      if (current.length) {
        chunks.push(current)
      }

      if (typeof result === 'string' && chunks.length === 1) {
        await r.edit({ content: lines.join('\n') })
        return
      }

      const prevButton = new ButtonBuilder()
        .setCustomId('jejudo_prevPage')
        .setStyle(ButtonStyle.Success)
        .setLabel('Prev')
      const nextButton = new ButtonBuilder()
        .setCustomId('jejudo_nextPage')
        .setStyle(ButtonStyle.Success)
        .setLabel('Next')
      const stopButton = new ButtonBuilder()
        .setCustomId('jejudo_stop')
        .setStyle(ButtonStyle.Danger)
        .setLabel('STOP')
      const pageButton = new ButtonBuilder()
        .setCustomId('jejudo_page')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)

      const generateButtons = (pageString: string): ButtonBuilder[] => [
        prevButton.setDisabled(currentPage === 1),
        pageButton.setLabel(pageString),
        nextButton.setDisabled(currentPage === chunks.length),
        stopButton,
      ]

      let currentPage = 1

      const update = (stop = false, i?: ButtonInteraction) => {
        const payload = {
          components:
            chunks.length > 1
              ? [
                  new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                    generateButtons(`${currentPage} / ${chunks.length}`).map(
                      (x) => {
                        if (stop) {
                          x.setDisabled(true)
                        }
                        return x
                      }
                    )
                  ),
                ]
              : [],
          content: codeBlock('js', chunks[currentPage - 1]),
        }

        if (i) {
          return i.update(payload)
        } else {
          return r.edit(payload)
        }
      }
      await update()

      if (chunks.length > 1) {
        const collector = channel.createMessageComponentCollector({
          componentType: ComponentType.Button,
          filter: (j) => j.user.id === author.id && j.message.id === r.id,
          time: 1000 * 60 * 60 * 10,
        })
        collector.on('collect', async (i) => {
          switch (i.customId) {
            case 'jejudo_nextPage':
              if (currentPage === chunks.length) return
              currentPage += 1
              await update(false, i)
              break
            case 'jejudo_prevPage':
              if (currentPage === 1) return
              currentPage -= 1
              await update(false, i)
              break
            case 'jejudo_stop':
              await i.deferUpdate()
              collector.stop()
              break
          }
        })
        collector.on('end', async () => {
          await update(true)
        })
      }
    } catch (e) {
      await r.edit(`Error\n${codeBlock('js', `${e}`)}`)
    }
  }
}
