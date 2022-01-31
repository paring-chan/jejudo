/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand } from '../structures'
import {
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  TextChannel,
} from 'discord.js'
import { codeBlock } from '@discordjs/builders'
import * as util from 'util'

export class EvaluateCommand extends JejudoCommand {
  constructor(public jejudo: Jejudo) {
    super({
      type: 'SUB_COMMAND',
      name: 'eval',
      description: 'Evaluate js code',
      options: [
        {
          type: 'STRING',
          name: 'code',
          description: 'Code to run',
          required: true,
        },
      ],
    })
  }
  async execute(i: CommandInteraction): Promise<void> {
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

      const prevButton = new MessageButton()
        .setCustomId('jejudo_prevPage')
        .setStyle('SUCCESS')
        .setLabel('Prev')
      const nextButton = new MessageButton()
        .setCustomId('jejudo_nextPage')
        .setStyle('SUCCESS')
        .setLabel('Next')
      const stopButton = new MessageButton()
        .setCustomId('jejudo_stop')
        .setStyle('DANGER')
        .setLabel('STOP')
      const pageButton = new MessageButton()
        .setCustomId('jejudo_page')
        .setStyle('PRIMARY')
        .setDisabled(true)

      const generateButtons = (pageString: string): MessageButton[] => [
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
            new MessageActionRow().addComponents(
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
        componentType: 'BUTTON',
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
