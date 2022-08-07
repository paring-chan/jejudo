/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import {
  ApplicationCommandSubCommandData,
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Message,
  User,
} from 'discord.js'

export abstract class JejudoCommand {
  protected constructor(
    public data: ApplicationCommandSubCommandData,
    public textCommandAliases: string[] = []
  ) {}

  async autocomplete(i: AutocompleteInteraction) {
    await i.respond([])
  }

  abstract execute(
    msg: Message,
    args: string,
    author: User,
    reference: Message | ChatInputCommandInteraction
  ): Promise<void>
}
