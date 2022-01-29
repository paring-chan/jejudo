/*
 * Copyright (c) 2022 pikokr. Licensed under the MIT license
 */

import {
  ApplicationCommandSubCommandData,
  CommandInteraction,
} from 'discord.js'

export abstract class JejudoCommand {
  protected constructor(public data: ApplicationCommandSubCommandData) {}

  abstract execute(i: CommandInteraction): Promise<void>
}
