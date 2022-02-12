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
import { spawn } from 'node-pty'
import { Terminal } from 'xterm-headless'
import { codeBlock } from '@discordjs/builders'

export class ShellCommand extends JejudoCommand {
  constructor(private jejudo: Jejudo) {
    super({
      type: 'SUB_COMMAND',
      name: 'exec',
      description: 'Execute a command',
      options: [
        {
          name: 'command',
          description: 'Command to run',
          required: true,
          type: 'STRING',
        },
      ],
    })
  }

  async execute(i: CommandInteraction): Promise<void> {
    const channel = (i.channel ??
      this.jejudo.client.channels.cache.get(i.channelId) ??
      (await this.jejudo.client.channels.fetch(i.channelId))) as TextChannel
    const r = await i.deferReply({ fetchReply: true })
    const shell =
      process.env.SHELL || (process.platform === 'win32' ? 'powershell' : null)
    if (!shell) return i.reply('environment variable `SHELL` not found.')
    const command = i.options.getString('command', true)
    const pty = spawn(shell, [], {
      rows: 24,
      cols: 80,
    })
    const term = new Terminal({
      rows: 24,
      cols: 80,
    })
    pty.onData((e) => {
      term.write(e)
    })

    pty.onExit(() => {
      buttonCollector.stop()
    })

    pty.write(`${command}\n`)

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

    await i.editReply({
      content: `Reply this message to send input\n${codeBlock(getContent())}`,
      components: [
        new MessageActionRow().addComponents(
          new MessageButton()
            .setStyle('DANGER')
            .setCustomId('jejudo_stop')
            .setLabel('Stop')
        ),
      ],
    })

    const interval = setInterval(async () => {
      await i.editReply(
        `Reply this message to send input\n${codeBlock(getContent())}`
      )
    }, 1000)

    const buttonCollector = channel.createMessageComponentCollector({
      time: 1000 * 60 * 60 * 10,
      filter: (j) => j.message.id === r.id && i.user.id === j.user.id,
      componentType: 'BUTTON',
    })

    buttonCollector.on('collect', async (i) => {
      await i.deferUpdate()
      if (i.customId === 'jejudo_stop') {
        buttonCollector.stop()
      }
    })

    buttonCollector.on('end', async () => {
      clearInterval(interval)

      console.log(`kill ${pty.pid}`)

      process.kill(pty.pid)

      console.log(`killed ${pty.pid}`)

      await i.editReply({
        components: [],
        content: codeBlock(getContent()),
      })

      messageCollector.stop()
    })

    const messageCollector = channel.createMessageCollector({
      time: 1000 * 60 * 60 * 10,
      filter: (m) => {
        return m.author.id === i.user.id && m.reference?.messageId === r.id
      },
    })

    messageCollector.on('collect', (msg) => {
      pty.write(`${msg.content}\n`)
    })
  }
}
