/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand, UpdateMessageFn } from '../structures'
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
  ModalBuilder,
  ModalActionRowComponentBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionCollector,
  InteractionType,
  ModalSubmitInteraction,
  verifyString,
  ChatInputCommandInteraction,
} from 'discord.js'
import * as util from 'util'

const splitMessage = (
  text: string,
  {
    maxLength = 2_000,
    char = '\n',
    prepend = '',
    append = '',
  }: {
    maxLength?: number
    char?: string | RegExp | (string | RegExp)[]
    prepend?: string
    append?: string
  } = {},
) => {
  text = verifyString(text)
  if (text.length <= maxLength) return [text]
  let splitText = [text]
  if (Array.isArray(char)) {
    while (
      char.length > 0 &&
      splitText.some((elem) => elem.length > maxLength)
    ) {
      const currentChar = char.shift()
      if (currentChar instanceof RegExp) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        splitText = splitText.flatMap((chunk) => chunk.match(currentChar)!)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        splitText = splitText.flatMap((chunk) => chunk.split(currentChar!))
      }
    }
  } else {
    splitText = text.split(char)
  }
  if (splitText.some((elem) => elem.length > maxLength))
    throw new RangeError('SPLIT_MAX_LEN')
  const messages = []
  let msg = ''
  for (const chunk of splitText) {
    if (msg && (msg + char + chunk + append).length > maxLength) {
      messages.push(msg + append)
      msg = prepend
    }
    msg += (msg && msg !== prepend ? char : '') + chunk
  }
  return messages.concat(msg).filter((m) => m)
}

export class EvaluateCommand extends JejudoCommand {
  constructor(public jejudo: Jejudo) {
    super(
      {
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
      },
      ['js'],
    )
  }
  async execute(
    m: Message,
    code: string,
    update: UpdateMessageFn,
    author: User,
    reference: Message | ChatInputCommandInteraction,
  ): Promise<void> {
    if (!code) {
      await update({ content: 'code is missing' })
      return
    }

    if (code.startsWith('```js\n') && code.endsWith('\n```')) {
      code = code.slice(6, code.length - 4)
    }

    const channel = m.channel

    const r = m

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const client = this.jejudo.client
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const message = reference ?? m
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const msg = message
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const i = reference
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const interaction = reference

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
            res = res.split(secret).join('[secret]')
          }
          return res
        })
      const chunks: string[] = splitMessage(lines.join('\n'), {
        char: [new RegExp(`.{1,1900}`, 'g'), '\n'],
        maxLength: 1900,
      })

      if (typeof result === 'string' && chunks.length === 1) {
        await update({ content: lines.join('\n') })
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

      const generateButtons = (pageString: string): ButtonBuilder[] => [
        prevButton.setDisabled(currentPage === 1),
        pageButton.setLabel(pageString),
        nextButton.setDisabled(currentPage === chunks.length),
        stopButton,
      ]

      let currentPage = 1

      const iterate = (stop = false, i?: ButtonInteraction) => {
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
                      },
                    ),
                  ),
                ]
              : [],
          content: codeBlock('js', chunks[currentPage - 1]),
        }

        if (i) {
          return i.update(payload)
        } else {
          return update(payload)
        }
      }
      await iterate()

      if (chunks.length > 1) {
        const collector = channel.createMessageComponentCollector({
          componentType: ComponentType.Button,
          filter: (j) => j.user.id === author.id && j.message.id === r.id,
          time: 1000 * 60 * 60 * 10,
        })
        const modalId = `jejudo_eval_page_${r.id}`

        const modal = new ModalBuilder()
          .setCustomId(modalId)
          .setTitle('Go to page')
          .addComponents(
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('page')
                .setLabel('Page')
                .setStyle(TextInputStyle.Short)
                .setRequired(true),
            ),
          )

        const modalCollector = new InteractionCollector(channel.client, {
          time: 1000 * 60 * 60 * 10,
          filter: async (j) =>
            author.id === j.user.id && j.customId === modalId,
          interactionType: InteractionType.ModalSubmit,
        })

        modalCollector.on('collect', async (j: ModalSubmitInteraction) => {
          const value = parseInt(j.fields.getTextInputValue('page'))

          if (isNaN(value)) {
            await j.reply({
              ephemeral: true,
              content: 'Got non-number value',
            })
            return
          }

          if (value <= 0 || value > chunks.length) {
            await j.reply({
              ephemeral: true,
              content: 'Value is out of range',
            })
            return
          }

          currentPage = value

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          await j.deferUpdate()

          await iterate()
        })

        collector.on('collect', async (i) => {
          switch (i.customId) {
            case 'jejudo_nextPage':
              if (currentPage === chunks.length) return
              currentPage += 1
              await iterate(false, i)
              break
            case 'jejudo_prevPage':
              if (currentPage === 1) return
              currentPage -= 1
              await iterate(false, i)
              break
            case 'jejudo_stop':
              await i.deferUpdate()
              collector.stop()
              break
            case 'jejudo_page':
              await i.showModal(modal)
          }
        })
        collector.on('end', async () => {
          await iterate(true)
        })
      }
    } catch (e) {
      await update({ content: `Error\n${codeBlock('js', `${e}`)}` })
    }
  }
}
