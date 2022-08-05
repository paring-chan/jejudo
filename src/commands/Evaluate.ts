/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand } from '../structures'
import {
  TextChannel,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  ButtonBuilder,
  ActionRowBuilder,
  codeBlock,
  ButtonStyle,
  MessageActionRowComponentBuilder,
  ComponentType,
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
  async execute(i: ChatInputCommandInteraction): Promise<void> {
    const channel = (i.channel ??
      this.jejudo.client.channels.cache.get(i.channelId) ??
      (await this.jejudo.client.channels.fetch(i.channelId))) as TextChannel

    const r = await i.deferReply({ fetchReply: true })
    const code = i.options.getString('code', true)

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
      if (typeof result === 'string') {
        await i.editReply({ content: lines[0] })
        return
      }
      const chunks: string[] = []
      let current = ''
      for (const line of lines) {
        if (current.length + line.length + 1 > 1900) {
          chunks.push(current)
          current = line
          continue
        }
        current += '\n' + line
      }
      if (current.length) {
        chunks.push(current)
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
      await i.editReply({
        content: codeBlock('js', chunks[0]),
      })

      const update = (stop = false) =>
        i.editReply({
          components: [
            new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
              generateButtons(`${currentPage} / ${chunks.length}`).map((x) => {
                if (stop) {
                  x.setDisabled(true)
                }
                return x
              })
            ),
          ],
          content: codeBlock('js', chunks[currentPage - 1]),
        })
      await update()

      const collector = channel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (j) => j.user.id === i.user.id && j.message.id === r.id,
        time: 1000 * 60 * 60 * 10,
      })
      collector.on('collect', async (i) => {
        await i.deferUpdate()
        switch (i.customId) {
          case 'jejudo_nextPage':
            if (currentPage === chunks.length) return
            currentPage += 1
            await update()
            break
          case 'jejudo_prevPage':
            if (currentPage === 1) return
            currentPage -= 1
            await update()
            break
          case 'jejudo_stop':
            collector.stop()
            break
        }
      })
      collector.on('end', async () => {
        await update(true)
      })
    } catch (e) {
      await i.editReply(`Error\n${codeBlock('js', `${e}`)}`)
    }
  }
}
