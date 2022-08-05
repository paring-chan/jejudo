/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import {
  ApplicationCommandSubCommandData,
  AutocompleteInteraction,
  Message,
  User,
} from 'discord.js'

export abstract class JejudoCommand {
  protected constructor(public data: ApplicationCommandSubCommandData) {}

  async autocomplete(i: AutocompleteInteraction) {
    await i.respond([])
  }

  abstract execute(msg: Message, args: string, author: User): Promise<void>
}
