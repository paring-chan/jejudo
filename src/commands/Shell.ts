/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import { Jejudo, JejudoCommand } from '../structures'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ApplicationCommandOptionType,
  ButtonStyle,
  MessageActionRowComponentBuilder,
  ComponentType,
  InteractionCollector,
  ModalBuilder,
  TextInputBuilder,
  ModalActionRowComponentBuilder,
  TextInputStyle,
  InteractionType,
  ModalSubmitInteraction,
  User,
  Message,
} from 'discord.js'
import { spawn } from 'node-pty'
import { Terminal } from 'xterm-headless'
import { codeBlock } from '@discordjs/builders'

export class ShellCommand extends JejudoCommand {
  constructor(private jejudo: Jejudo) {
    super(
      {
        type: ApplicationCommandOptionType.Subcommand,
        name: 'exec',
        description: 'Execute a command',
        options: [
          {
            name: 'command',
            description: 'Command to run',
            required: true,
            type: ApplicationCommandOptionType.String,
          },
        ],
      },
      ['sh']
    )
  }

  async execute(msg: Message, command: string, author: User): Promise<void> {
    const r = msg
    const channel = msg.channel
    const shell =
      process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : null)
    if (!shell) {
      await r.edit('environment variable `SHELL` not found.')
      return
    }
    const separator = process.platform === 'win32' ? '\r\n' : '\n'
    const pty = spawn(shell, [], {
      rows: 24,
      cols: 80,
    })
    const term = new Terminal({
      rows: 24,
      cols: 80,
    })

    let shouldUpdate = false

    pty.onData((e) => {
      term.write(e)
      shouldUpdate = true
    })

    pty.onExit(() => {
      term.dispose()
      buttonCollector.stop()
      console.log(`disposed ${pty.pid}`)
    })

    pty.write(`${command}${separator}`)

    const getContent = () => {
      const lines: string[] = []
      for (
        let j = term.buffer.active.length - 24;
        j < term.buffer.active.length;
        j++
      ) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const line = term.buffer.active.getLine(j)!
        lines.push(line.translateToString(false))
      }
      return lines.join('\n')
    }

    const buttons = [
      new ButtonBuilder()
        .setStyle(ButtonStyle.Danger)
        .setCustomId('jejudo_stop')
        .setLabel('Stop'),
      new ButtonBuilder()
        .setStyle(ButtonStyle.Primary)
        .setCustomId('jejudo_exec_input')
        .setLabel('Send input'),
    ]

    await r.edit({
      content: codeBlock(getContent()),
      components: [
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          ...buttons
        ),
      ],
    })

    const interval = setInterval(async () => {
      if (shouldUpdate) {
        shouldUpdate = false
        await r.edit(codeBlock(getContent()))
      }
    }, 1000)

    const modalId = `jejudo_exec_modal_${r.id}`

    const modal = new ModalBuilder()
      .setCustomId(modalId)
      .setTitle('Send line')
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('input')
            .setLabel('Line to send')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      )

    const buttonCollector = channel.createMessageComponentCollector({
      time: 1000 * 60 * 60 * 10,
      filter: async (j) => {
        const match = j.message.id === r.id && author.id === j.user.id

        if (!match) await j.deferUpdate()

        return match
      },
      componentType: ComponentType.Button,
    })

    const modalCollector = new InteractionCollector(channel.client, {
      time: 1000 * 60 * 60 * 10,
      filter: async (j) => author.id === j.user.id && j.customId === modalId,
      interactionType: InteractionType.ModalSubmit,
    })

    modalCollector.on('collect', async (j: ModalSubmitInteraction) => {
      const value = j.fields.getTextInputValue('input')

      pty.write(`${value}${separator}`)

      j.reply({
        content: 'sent!',
        ephemeral: true,
      })
    })

    buttonCollector.on('collect', async (i) => {
      if (i.customId === 'jejudo_stop') {
        buttonCollector.stop()
        await i.deferUpdate()
      } else if (i.customId === 'jejudo_exec_input') {
        await i.showModal(modal)
      }
    })

    buttonCollector.on('end', async () => {
      clearInterval(interval)

      console.log(`kill ${pty.pid}`)

      process.kill(pty.pid)

      console.log(`killed ${pty.pid}`)

      await r.edit({
        components: [
          new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
            ...buttons.map((x) => x.setDisabled(true))
          ),
        ],
        content: codeBlock(getContent()),
      })

      modalCollector.stop()
    })
  }
}
